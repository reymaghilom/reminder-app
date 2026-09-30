package expo.modules.reminderalarm

import android.app.AlarmManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class AlarmRestorationReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    val supported = action == Intent.ACTION_BOOT_COMPLETED ||
      action == Intent.ACTION_MY_PACKAGE_REPLACED ||
      action == Intent.ACTION_TIME_CHANGED ||
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

    ProductionAlarmScheduler.restoreRegistered(context, action)
  }

  companion object {
    private const val TAG = "ReminderAlarm"
  }
}
