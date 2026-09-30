package expo.modules.reminderalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log

class ProductionAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ProductionAlarmScheduler.productionAction(context)) return
    val alarmKey = intent.getStringExtra(EXTRA_ALARM_KEY) ?: return
    val spec = NativeAlarmRegistry.get(context, alarmKey) ?: run {
      Log.w(TAG, "Ignoring production alarm missing from derived registry: $alarmKey")
      return
    }

    val receivedAtMillis = System.currentTimeMillis()
    Log.i(
      TAG,
      "PRODUCTION_ALARM_FIRED alarmKey=${spec.alarmKey} " +
        "triggerAtMillis=${spec.triggerAtMillis} receivedAtMillis=$receivedAtMillis",
    )

    try {
      postNotification(context, spec)
    } finally {
      NativeAlarmRegistry.remove(context, alarmKey)
      ProductionAlarmScheduler.pendingIntent(context, spec, PendingIntent.FLAG_NO_CREATE)?.cancel()
      try {
        ProductionAlarmScheduler.rollDailyForward(context, spec)
      } catch (error: RuntimeException) {
        Log.w(TAG, "Unable to roll daily alarm forward: $alarmKey", error)
      }
    }
  }

  /** Also used by restoration to deliver a recently missed alarm late; it has no receiver state. */
  internal fun postNotification(context: Context, spec: AlarmOccurrenceSpec) {
    val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
      ?: return
    val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: Settings.System.DEFAULT_NOTIFICATION_URI
    val vibration = longArrayOf(0, 500, 250, 500, 250, 750)
    // Channel vibration cannot change after creation, so the app's vibration setting selects a channel.
    val channelId = if (spec.vibrate) CHANNEL_ID else NO_VIBRATION_CHANNEL_ID

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      notificationManager.createNotificationChannel(
        NotificationChannel(
          channelId,
          if (spec.vibrate) "Reminder Alarms" else "Reminder Alarms (no vibration)",
          NotificationManager.IMPORTANCE_HIGH,
        ).apply {
          description = "Time-sensitive Reminder App alarms"
          lockscreenVisibility = Notification.VISIBILITY_PUBLIC
          enableVibration(spec.vibrate)
          vibrationPattern = if (spec.vibrate) vibration else null
          setSound(
            alarmSound,
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_ALARM)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build(),
          )
        },
      )
    }

    val contentIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
      it.setData(intentData(spec.alarmKey))
        .putExtra(EXTRA_ALARM_KEY, spec.alarmKey)
        .putExtra(EXTRA_REMINDER_ID, spec.reminderId)
        .putExtra(EXTRA_SCHEDULED_DATE, spec.scheduledDate)
        .putExtra(EXTRA_KIND, spec.kind)
        .putExtra(EXTRA_SEQUENCE, spec.sequence)
        .putExtra(EXTRA_TRIGGER_AT_MILLIS, spec.triggerAtMillis)
      PendingIntent.getActivity(
        context,
        ProductionAlarmScheduler.PRODUCTION_SHOW_REQUEST_CODE,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
    // Recording the intake is app/SQLite logic, so the action opens the app on a deep link that does it.
    // (Android 12 blocks broadcast "trampolines" that would start an activity from a notification action.)
    val takenIntent = Intent(Intent.ACTION_VIEW, markTakenUri(spec)).setPackage(context.packageName)
    val takenAction = Notification.Action.Builder(
      Icon.createWithResource(context, context.applicationInfo.icon),
      "Mark as taken",
      PendingIntent.getActivity(
        context,
        MARK_TAKEN_REQUEST_CODE,
        takenIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      ),
    ).build()
    val metadata = Bundle().apply {
      putString(EXTRA_ALARM_KEY, spec.alarmKey)
      putLong(EXTRA_REMINDER_ID, spec.reminderId)
      putString(EXTRA_SCHEDULED_DATE, spec.scheduledDate)
      putString(EXTRA_KIND, spec.kind)
      putInt(EXTRA_SEQUENCE, spec.sequence)
      putLong(EXTRA_TRIGGER_AT_MILLIS, spec.triggerAtMillis)
    }
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, channelId)
    } else {
      Notification.Builder(context)
    }
    val notification = builder
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(spec.title)
      .setContentText(spec.body)
      .setCategory(Notification.CATEGORY_ALARM)
      .setPriority(Notification.PRIORITY_HIGH)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setAutoCancel(true)
      .setSound(alarmSound)
      .setVibrate(if (spec.vibrate) vibration else null)
      .setExtras(metadata)
      .addAction(takenAction)
      .apply { if (contentIntent != null) setContentIntent(contentIntent) }
      .build()

    try {
      notificationManager.notify(spec.alarmKey, NOTIFICATION_ID, notification)
    } catch (error: SecurityException) {
      Log.w(TAG, "Unable to post production alarm notification", error)
    }
  }

  private fun markTakenUri(spec: AlarmOccurrenceSpec) = android.net.Uri.Builder()
    .scheme(APP_LINK_SCHEME)
    .authority("alarm-taken")
    .appendQueryParameter("reminderId", spec.reminderId.toString())
    .appendQueryParameter("date", spec.scheduledDate)
    .build()

  private fun intentData(alarmKey: String) = android.net.Uri.Builder()
    .scheme("reminder-alarm")
    .authority("notification")
    .appendPath(alarmKey)
    .build()

  companion object {
    const val CHANNEL_ID = "native-reminder-alarms"
    const val NO_VIBRATION_CHANNEL_ID = "native-reminder-alarms-no-vibration"
    const val NOTIFICATION_ID = 920001
    const val MARK_TAKEN_REQUEST_CODE = 920002
    /** Matches "scheme" in app.json; handled by app/alarm-taken.tsx. */
    private const val APP_LINK_SCHEME = "mamacare"
    const val EXTRA_ALARM_KEY = "alarmKey"
    const val EXTRA_REMINDER_ID = "reminderId"
    const val EXTRA_SCHEDULED_DATE = "scheduledDate"
    const val EXTRA_KIND = "kind"
    const val EXTRA_SEQUENCE = "sequence"
    const val EXTRA_TRIGGER_AT_MILLIS = "triggerAtMillis"
    private const val TAG = "ReminderAlarm"
  }
}
