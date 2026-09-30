package expo.modules.reminderalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.drawable.Icon
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import android.util.Log

/**
 * Rings like an alarm clock: plays the alarm tone itself on the alarm stream (so other notifications
 * cannot cut it off), repeats vibration, keeps the CPU awake, pauses while another app (e.g. a call)
 * holds audio focus, and silences itself after [AUTO_SILENCE_MILLIS]. Ringing stops on Stop,
 * Mark as taken, or auto-silence; alarms that were not marked taken stay as quiet notifications.
 */
class AlarmRingingService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private val ringing = LinkedHashMap<String, AlarmOccurrenceSpec>()
  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var focusRequest: AudioFocusRequest? = null
  private val autoSilence = Runnable {
    Log.i(TAG, "PRODUCTION_ALARM_AUTO_SILENCED keys=${ringing.keys}")
    stopRinging(ringing.keys.toList())
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_RING -> {
        val spec = intent.getStringExtra(EXTRA_ALARM_KEY)?.let { pendingSpecs.remove(it) }
        if (spec == null) {
          if (ringing.isEmpty()) stopSelf()
          return START_NOT_STICKY
        }
        ring(spec)
      }
      ACTION_STOP -> stopRinging(ringing.keys.toList())
      else -> if (ringing.isEmpty()) stopSelf()
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    instance = null
    handler.removeCallbacks(autoSilence)
    releaseOutputs()
    super.onDestroy()
  }

  private fun ring(spec: AlarmOccurrenceSpec) {
    ringing.remove(spec.alarmKey)
    ringing[spec.alarmKey] = spec
    val notification = ringingNotification(spec)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(RINGING_NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(RINGING_NOTIFICATION_ID, notification)
    }
    Log.i(TAG, "PRODUCTION_ALARM_RINGING alarmKey=${spec.alarmKey} ringing=${ringing.size}")
    startOutputs()
    handler.removeCallbacks(autoSilence)
    handler.postDelayed(autoSilence, AUTO_SILENCE_MILLIS)
  }

  /** Stops ringing for [keys]; keeps ringing for any others. Not-taken alarms remain as quiet notifications. */
  fun stopRinging(keys: Collection<String>, markedTaken: Boolean = false) {
    val stopped = keys.mapNotNull { ringing.remove(it) }
    if (stopped.isEmpty()) return
    if (!markedTaken) stopped.forEach { ProductionAlarmReceiver.postQuietNotification(this, it) }
    Log.i(TAG, "PRODUCTION_ALARM_STOPPED keys=${stopped.map { it.alarmKey }} markedTaken=$markedTaken remaining=${ringing.size}")
    val latest = ringing.values.lastOrNull()
    if (latest == null) {
      handler.removeCallbacks(autoSilence)
      releaseOutputs()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE) else stopForeground(true)
      stopSelf()
      AlarmRingingActivity.finishIfShowing()
    } else {
      notificationManager().notify(RINGING_NOTIFICATION_ID, ringingNotification(latest))
      startOutputs()
    }
  }

  private fun startOutputs() {
    acquireWakeLock()
    val vibrate = ringing.values.any { it.vibrate }
    if (player == null) {
      requestFocus()
      player = createPlayer()?.also { it.start() }
    }
    if (vibrate) startVibration() else stopVibration()
  }

  private fun createPlayer(): MediaPlayer? {
    val attributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    val candidates = listOfNotNull(
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
      Settings.System.DEFAULT_NOTIFICATION_URI,
    )
    for (uri in candidates) {
      try {
        return MediaPlayer().apply {
          setAudioAttributes(attributes)
          setDataSource(this@AlarmRingingService, uri)
          isLooping = true
          prepare()
        }
      } catch (error: Exception) {
        Log.w(TAG, "Unable to play alarm tone $uri", error)
      }
    }
    return null
  }

  private fun startVibration() {
    val target = vibrator ?: (getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator)?.also { vibrator = it } ?: return
    val pattern = longArrayOf(0, 500, 250, 500, 250, 750, 1000)
    val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      target.vibrate(VibrationEffect.createWaveform(pattern, 0), attributes)
    } else {
      @Suppress("DEPRECATION")
      target.vibrate(pattern, 0, attributes)
    }
  }

  private fun stopVibration() {
    vibrator?.cancel()
  }

  private fun requestFocus() {
    val audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
      .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build())
      .setOnAudioFocusChangeListener { change ->
        // Pause while a call or another app takes focus; resume when it is returned.
        when (change) {
          AudioManager.AUDIOFOCUS_LOSS, AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> player?.takeIf { it.isPlaying }?.pause()
          AudioManager.AUDIOFOCUS_GAIN -> if (ringing.isNotEmpty()) player?.start()
        }
      }
      .build()
    focusRequest = request
    audioManager.requestAudioFocus(request)
  }

  private fun releaseOutputs() {
    player?.run {
      try {
        stop()
      } catch (_: IllegalStateException) {
      }
      release()
    }
    player = null
    stopVibration()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      focusRequest?.let { (getSystemService(Context.AUDIO_SERVICE) as? AudioManager)?.abandonAudioFocusRequest(it) }
    }
    focusRequest = null
    wakeLock?.takeIf { it.isHeld }?.release()
    wakeLock = null
  }

  private fun acquireWakeLock() {
    if (wakeLock?.isHeld == true) return
    val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
    wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ReminderApp:AlarmRinging").apply {
      acquire(AUTO_SILENCE_MILLIS + 60_000L)
    }
  }

  private fun ringingNotification(spec: AlarmOccurrenceSpec): Notification {
    ensureRingingChannel(this)
    val fullScreen = PendingIntent.getActivity(
      this,
      FULL_SCREEN_REQUEST_CODE,
      Intent(this, AlarmRingingActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val stop = PendingIntent.getService(
      this,
      STOP_REQUEST_CODE,
      Intent(this, AlarmRingingService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val icon = Icon.createWithResource(this, applicationInfo.icon)
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, RINGING_CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this).setPriority(Notification.PRIORITY_MAX)
    }
    return builder
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle(spec.title)
      .setContentText(spec.body)
      .setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setShowWhen(true)
      .setContentIntent(fullScreen)
      .setFullScreenIntent(fullScreen, true)
      .addAction(Notification.Action.Builder(icon, "Mark as taken", ProductionAlarmReceiver.markTakenPendingIntent(this, spec)).build())
      .addAction(Notification.Action.Builder(icon, "Stop", stop).build())
      .build()
  }

  private fun notificationManager() = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  companion object {
    const val ACTION_RING = "expo.modules.reminderalarm.action.RING"
    const val ACTION_STOP = "expo.modules.reminderalarm.action.STOP"
    const val EXTRA_ALARM_KEY = "alarmKey"
    const val RINGING_NOTIFICATION_ID = 920010
    const val RINGING_CHANNEL_ID = "reminder-alarm-ringing"
    /** Android Clock's default "silence after" duration. */
    const val AUTO_SILENCE_MILLIS = 10 * 60 * 1000L
    private const val FULL_SCREEN_REQUEST_CODE = 920011
    private const val STOP_REQUEST_CODE = 920012
    private const val TAG = "ReminderAlarm"

    /** Specs handed from the receiver to the service start; kept in memory because the service runs in-process. */
    private val pendingSpecs = HashMap<String, AlarmOccurrenceSpec>()

    @Volatile
    var instance: AlarmRingingService? = null
      private set

    fun currentSpec(): AlarmOccurrenceSpec? = instance?.ringing?.values?.lastOrNull()

    /** Starts ringing for [spec]. Returns false when Android refuses a foreground service right now. */
    fun start(context: Context, spec: AlarmOccurrenceSpec): Boolean {
      pendingSpecs[spec.alarmKey] = spec
      val intent = Intent(context, AlarmRingingService::class.java)
        .setAction(ACTION_RING)
        .putExtra(EXTRA_ALARM_KEY, spec.alarmKey)
      return try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
        true
      } catch (error: RuntimeException) {
        // IllegalStateException / ForegroundServiceStartNotAllowedException when started outside an exemption.
        pendingSpecs.remove(spec.alarmKey)
        Log.w(TAG, "Unable to start alarm ringing service for ${spec.alarmKey}", error)
        false
      }
    }

    /** Stops ringing for alarms of a dose that was just handled (for example marked taken in the app). */
    fun stopKeys(keys: Collection<String>, markedTaken: Boolean) {
      Handler(Looper.getMainLooper()).post { instance?.stopRinging(keys, markedTaken) }
    }

    fun stopAll() {
      Handler(Looper.getMainLooper()).post { instance?.let { it.stopRinging(it.ringing.keys.toList()) } }
    }

    fun ensureRingingChannel(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.createNotificationChannel(
        NotificationChannel(RINGING_CHANNEL_ID, "Ringing reminder alarms", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Shown while a reminder alarm is ringing"
          lockscreenVisibility = Notification.VISIBILITY_PUBLIC
          // The service plays the tone and vibration itself, so the channel stays silent.
          setSound(null as Uri?, null)
          enableVibration(false)
        },
      )
    }
  }
}
