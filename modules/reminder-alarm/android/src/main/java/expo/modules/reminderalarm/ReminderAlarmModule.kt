package expo.modules.reminderalarm

import android.app.AlarmManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
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

    AsyncFunction("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@AsyncFunction false

      val context = appContext.reactContext ?: return@AsyncFunction false
      val intent = Intent(
        Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
        Uri.parse("package:${context.packageName}"),
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

      if (intent.resolveActivity(context.packageManager) == null) return@AsyncFunction false

      try {
        context.startActivity(intent)
        true
      } catch (_: ActivityNotFoundException) {
        false
      } catch (_: SecurityException) {
        false
      }
    }
  }
}
