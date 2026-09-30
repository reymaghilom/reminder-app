package expo.modules.reminderalarm

import android.app.AlarmManager
import android.app.PendingIntent
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

    AsyncFunction("scheduleTestAlarm") { triggerAtMillisValue: Double ->
      val method = "setAlarmClock"
      val triggerAtMillis = triggerAtMillisValue.toLong()
      val context = appContext.reactContext
        ?: return@AsyncFunction testAlarmResult(false, triggerAtMillis, method, "context_unavailable")
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
        ?: return@AsyncFunction testAlarmResult(false, triggerAtMillis, method, "alarm_manager_unavailable")

      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
        return@AsyncFunction testAlarmResult(false, triggerAtMillis, method, "unsupported_api")
      }
      if (!triggerAtMillisValue.isFinite() || triggerAtMillis <= System.currentTimeMillis()) {
        return@AsyncFunction testAlarmResult(false, triggerAtMillis, method, "invalid_trigger_time")
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
        return@AsyncFunction testAlarmResult(false, triggerAtMillis, method, "exact_alarm_access_required")
      }

      val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?: return@AsyncFunction testAlarmResult(false, triggerAtMillis, method, "launch_intent_unavailable")
      val showIntent = PendingIntent.getActivity(
        context,
        ReminderAlarmReceiver.TEST_SHOW_REQUEST_CODE,
        launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      val operation = ReminderAlarmReceiver.getTestAlarmPendingIntent(
        context,
        PendingIntent.FLAG_UPDATE_CURRENT,
        triggerAtMillis,
      ) ?: return@AsyncFunction testAlarmResult(false, triggerAtMillis, method, "pending_intent_unavailable")

      ReminderAlarmReceiver.getTestAlarmPendingIntent(context, PendingIntent.FLAG_NO_CREATE)?.let {
        alarmManager.cancel(it)
      }

      try {
        alarmManager.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAtMillis, showIntent), operation)
        testAlarmResult(true, triggerAtMillis, method, null)
      } catch (_: SecurityException) {
        operation.cancel()
        testAlarmResult(false, triggerAtMillis, method, "exact_alarm_access_required")
      } catch (_: IllegalArgumentException) {
        operation.cancel()
        testAlarmResult(false, triggerAtMillis, method, "scheduling_failed")
      }
    }

    AsyncFunction("cancelTestAlarm") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
        ?: return@AsyncFunction false
      val operation = ReminderAlarmReceiver.getTestAlarmPendingIntent(context, PendingIntent.FLAG_NO_CREATE)
        ?: return@AsyncFunction false
      alarmManager.cancel(operation)
      operation.cancel()
      true
    }

    AsyncFunction("scheduleAlarmOccurrence") { rawSpec: Map<String, Any?> ->
      val parsed = AlarmOccurrenceSpec.fromMap(rawSpec)
      val spec = parsed.spec
        ?: return@AsyncFunction productionAlarmResult(
          scheduled = false,
          alarmKey = rawSpec["alarmKey"] as? String ?: "",
          triggerAtMillis = (rawSpec["triggerAtMillis"] as? Number)?.toLong() ?: 0L,
          failureReason = parsed.error ?: "invalid_spec",
        )
      val context = appContext.reactContext
        ?: return@AsyncFunction productionAlarmResult(
          false,
          spec.alarmKey,
          spec.triggerAtMillis,
          "context_unavailable",
        )
      val outcome = ProductionAlarmScheduler.schedule(context, spec, persistAfterSuccess = true)
      productionAlarmResult(
        outcome.scheduled,
        spec.alarmKey,
        spec.triggerAtMillis,
        outcome.failureReason,
      )
    }

    AsyncFunction("cancelAlarmOccurrence") { alarmKey: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      ProductionAlarmScheduler.cancel(context, alarmKey)
    }

    AsyncFunction("cancelAlarmOccurrences") { alarmKeys: List<String> ->
      val context = appContext.reactContext ?: return@AsyncFunction 0
      alarmKeys.distinct().count { ProductionAlarmScheduler.cancel(context, it) }
    }

    AsyncFunction("getScheduledAlarmRegistry") {
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any>>()
      NativeAlarmRegistry.all(context).map(AlarmOccurrenceSpec::toMap)
    }

    AsyncFunction("clearNativeAlarmRegistry") {
      val context = appContext.reactContext ?: return@AsyncFunction 0
      val entries = NativeAlarmRegistry.all(context)
      entries.forEach { ProductionAlarmScheduler.cancel(context, it.alarmKey) }
      NativeAlarmRegistry.clear(context)
      entries.size
    }
  }
}

private fun testAlarmResult(
  scheduled: Boolean,
  triggerAtMillis: Long,
  method: String,
  failureReason: String?,
): Map<String, Any?> = mapOf(
  "scheduled" to scheduled,
  "triggerAtMillis" to triggerAtMillis.toDouble(),
  "method" to method,
  "failureReason" to failureReason,
)

private fun productionAlarmResult(
  scheduled: Boolean,
  alarmKey: String,
  triggerAtMillis: Long,
  failureReason: String?,
): Map<String, Any?> = mapOf(
  "scheduled" to scheduled,
  "alarmKey" to alarmKey,
  "triggerAtMillis" to triggerAtMillis.toDouble(),
  "method" to "setAlarmClock",
  "failureReason" to failureReason,
)
