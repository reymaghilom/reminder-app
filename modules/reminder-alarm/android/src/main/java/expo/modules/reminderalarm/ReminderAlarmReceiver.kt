package expo.modules.reminderalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.provider.Settings
import android.util.Log

class ReminderAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != testAction(context)) return

    val triggerAtMillis = intent.getLongExtra(EXTRA_TRIGGER_AT_MILLIS, 0L)
    val receivedAtMillis = System.currentTimeMillis()
    Log.i(TAG, "TEST_ALARM_FIRED triggerAtMillis=$triggerAtMillis receivedAtMillis=$receivedAtMillis")

    val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
      ?: return
    val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: Settings.System.DEFAULT_NOTIFICATION_URI

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        TEST_CHANNEL_ID,
        "Native Alarm Test",
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = "Temporary native exact-alarm test notifications"
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 500, 250, 500, 250, 750)
        setSound(
          alarmSound,
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
      }
      notificationManager.createNotificationChannel(channel)
    }

    val notificationBuilder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, TEST_CHANNEL_ID)
    } else {
      Notification.Builder(context)
    }
    val notification = notificationBuilder
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle("Reminder App Test Alarm")
      .setContentText("Native exact alarm fired successfully.")
      .setCategory(Notification.CATEGORY_ALARM)
      .setPriority(Notification.PRIORITY_HIGH)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setAutoCancel(true)
      .setSound(alarmSound)
      .setVibrate(longArrayOf(0, 500, 250, 500, 250, 750))
      .build()

    try {
      notificationManager.notify(TEST_NOTIFICATION_ID, notification)
    } catch (error: SecurityException) {
      Log.w(TAG, "Unable to post test alarm notification", error)
    } finally {
      getTestAlarmPendingIntent(context, PendingIntent.FLAG_NO_CREATE)?.cancel()
    }
  }

  companion object {
    const val TEST_REQUEST_CODE = 910001
    const val TEST_SHOW_REQUEST_CODE = 910002
    const val TEST_CHANNEL_ID = "native-alarm-test"
    const val TEST_NOTIFICATION_ID = 910001
    const val EXTRA_TRIGGER_AT_MILLIS = "triggerAtMillis"
    private const val TAG = "ReminderAlarm"

    fun testAction(context: Context): String = "${context.packageName}.reminderalarm.TEST_ALARM"

    fun getTestAlarmPendingIntent(
      context: Context,
      creationFlag: Int,
      triggerAtMillis: Long? = null,
    ): PendingIntent? {
      val intent = Intent(context, ReminderAlarmReceiver::class.java)
        .setAction(testAction(context))
        .setPackage(context.packageName)
      if (triggerAtMillis != null) intent.putExtra(EXTRA_TRIGGER_AT_MILLIS, triggerAtMillis)
      return PendingIntent.getBroadcast(
        context,
        TEST_REQUEST_CODE,
        intent,
        creationFlag or PendingIntent.FLAG_IMMUTABLE,
      )
    }
  }
}
