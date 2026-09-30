package expo.modules.reminderalarm

import android.app.AlarmManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import java.util.TimeZone

class AlarmRestorationReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    val supported = action == Intent.ACTION_BOOT_COMPLETED ||
      action == Intent.ACTION_MY_PACKAGE_REPLACED ||
      action == Intent.ACTION_TIME_CHANGED ||
      action == Intent.ACTION_TIMEZONE_CHANGED ||
      (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
        action == AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED)
    if (!supported) return

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
      action == AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED &&
      !ProductionAlarmScheduler.canScheduleExactAlarms(context)
    ) {
      Log.i(TAG, "Exact-alarm permission broadcast received without granted capability")
      return
    }

    // The broadcast carries the new zone; prefer it in case this process has not refreshed its default yet.
    val zone = intent.getStringExtra(EXTRA_TIME_ZONE)?.let(TimeZone::getTimeZone) ?: TimeZone.getDefault()
    ProductionAlarmScheduler.restoreRegistered(context, action, zone)
  }

  companion object {
    private const val TAG = "ReminderAlarm"
    /** Intent.EXTRA_TIMEZONE, which is hidden from the public SDK. */
    private const val EXTRA_TIME_ZONE = "time-zone"
  }
}
