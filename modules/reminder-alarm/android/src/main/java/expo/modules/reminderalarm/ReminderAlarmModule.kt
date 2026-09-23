package expo.modules.reminderalarm

import android.app.AlarmManager
import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ReminderAlarmModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ReminderAlarm")

    AsyncFunction("getAlarmCapabilities") {
      val apiLevel = Build.VERSION.SDK_INT
      val alarmManager = appContext.reactContext
        ?.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
      val exactAlarmSupported = alarmManager != null && apiLevel >= Build.VERSION_CODES.KITKAT
      val canScheduleExactAlarms = when {
        !exactAlarmSupported -> false
        apiLevel >= Build.VERSION_CODES.S -> alarmManager.canScheduleExactAlarms()
        else -> true
      }

      mapOf(
        "platform" to "android",
        "apiLevel" to apiLevel,
        "exactAlarmSupported" to exactAlarmSupported,
        "canScheduleExactAlarms" to canScheduleExactAlarms,
      )
    }
  }
}
