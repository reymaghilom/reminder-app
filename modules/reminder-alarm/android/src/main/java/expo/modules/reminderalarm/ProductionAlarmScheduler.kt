package expo.modules.reminderalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log

object ProductionAlarmScheduler {
  const val PRODUCTION_REQUEST_CODE = 920000
  const val PRODUCTION_SHOW_REQUEST_CODE = 920001
  private const val TAG = "ReminderAlarm"

  fun schedule(
    context: Context,
    spec: AlarmOccurrenceSpec,
    persistAfterSuccess: Boolean,
  ): ProductionScheduleOutcome {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
      ?: return ProductionScheduleOutcome(false, "alarm_manager_unavailable")
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
      return ProductionScheduleOutcome(false, "unsupported_api")
    }
    if (spec.triggerAtMillis <= System.currentTimeMillis()) {
      return ProductionScheduleOutcome(false, "invalid_trigger_time")
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
      return ProductionScheduleOutcome(false, "exact_alarm_access_required")
    }

    val operation = pendingIntent(context, spec, PendingIntent.FLAG_UPDATE_CURRENT)
      ?: return ProductionScheduleOutcome(false, "pending_intent_unavailable")
    val showIntent = showPendingIntent(context, spec)
      ?: return ProductionScheduleOutcome(false, "launch_intent_unavailable")

    return try {
      pendingIntent(context, spec, PendingIntent.FLAG_NO_CREATE)?.let(alarmManager::cancel)
      alarmManager.setAlarmClock(
        AlarmManager.AlarmClockInfo(spec.triggerAtMillis, showIntent),
        operation,
      )
      if (persistAfterSuccess && !NativeAlarmRegistry.put(context, spec)) {
        alarmManager.cancel(operation)
        operation.cancel()
        ProductionScheduleOutcome(false, "registry_write_failed")
      } else {
        Log.i(TAG, "PRODUCTION_ALARM_SCHEDULED alarmKey=${spec.alarmKey} triggerAtMillis=${spec.triggerAtMillis}")
        ProductionScheduleOutcome(true, null)
      }
    } catch (_: SecurityException) {
      operation.cancel()
      ProductionScheduleOutcome(false, "exact_alarm_access_required")
    } catch (_: IllegalArgumentException) {
      operation.cancel()
      ProductionScheduleOutcome(false, "scheduling_failed")
    }
  }

  fun cancel(context: Context, alarmKey: String, removeFromRegistry: Boolean = true): Boolean {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
    val existingSpec = NativeAlarmRegistry.get(context, alarmKey)
    val identitySpec = existingSpec ?: identityOnlySpec(alarmKey)
    var found = existingSpec != null
    if (alarmManager != null && identitySpec != null) {
      pendingIntent(context, identitySpec, PendingIntent.FLAG_NO_CREATE)?.let {
        alarmManager.cancel(it)
        it.cancel()
        found = true
      }
    }
    if (removeFromRegistry && NativeAlarmRegistry.remove(context, alarmKey)) found = true
    return found
  }

  fun restoreRegistered(context: Context, reason: String): RestorationSummary {
    val entries = NativeAlarmRegistry.all(context)
    val now = System.currentTimeMillis()
    var restored = 0
    var removedPast = 0
    var failed = 0

    for (spec in entries) {
      if (spec.triggerAtMillis <= now) {
        cancel(context, spec.alarmKey)
        removedPast += 1
        continue
      }
      val outcome = schedule(context, spec, persistAfterSuccess = false)
      if (outcome.scheduled) restored += 1 else failed += 1
    }
    val summary = RestorationSummary(entries.size, restored, removedPast, failed)
    Log.i(
      TAG,
      "PRODUCTION_ALARM_RESTORE reason=$reason registry=${summary.registryCount} " +
        "restored=${summary.restored} removedPast=${summary.removedPast} failed=${summary.failed}",
    )
    return summary
  }

  fun canScheduleExactAlarms(context: Context): Boolean {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return false
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()
  }

  fun pendingIntent(
    context: Context,
    spec: AlarmOccurrenceSpec,
    creationFlag: Int,
  ): PendingIntent? {
    val intent = Intent(context, ProductionAlarmReceiver::class.java)
      .setAction(productionAction(context))
      .setPackage(context.packageName)
      .setData(occurrenceUri(spec.alarmKey))
      .putExtra(ProductionAlarmReceiver.EXTRA_ALARM_KEY, spec.alarmKey)
      .putExtra(ProductionAlarmReceiver.EXTRA_REMINDER_ID, spec.reminderId)
      .putExtra(ProductionAlarmReceiver.EXTRA_SCHEDULED_DATE, spec.scheduledDate)
      .putExtra(ProductionAlarmReceiver.EXTRA_KIND, spec.kind)
      .putExtra(ProductionAlarmReceiver.EXTRA_SEQUENCE, spec.sequence)
      .putExtra(ProductionAlarmReceiver.EXTRA_TRIGGER_AT_MILLIS, spec.triggerAtMillis)
    return PendingIntent.getBroadcast(
      context,
      PRODUCTION_REQUEST_CODE,
      intent,
      creationFlag or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  fun productionAction(context: Context): String =
    "${context.packageName}.reminderalarm.PRODUCTION_ALARM"

  private fun showPendingIntent(context: Context, spec: AlarmOccurrenceSpec): PendingIntent? {
    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    launchIntent
      .setData(showUri(spec.alarmKey))
      .putExtra(ProductionAlarmReceiver.EXTRA_ALARM_KEY, spec.alarmKey)
      .putExtra(ProductionAlarmReceiver.EXTRA_REMINDER_ID, spec.reminderId)
      .putExtra(ProductionAlarmReceiver.EXTRA_SCHEDULED_DATE, spec.scheduledDate)
      .putExtra(ProductionAlarmReceiver.EXTRA_KIND, spec.kind)
      .putExtra(ProductionAlarmReceiver.EXTRA_SEQUENCE, spec.sequence)
    return PendingIntent.getActivity(
      context,
      PRODUCTION_SHOW_REQUEST_CODE,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun occurrenceUri(alarmKey: String): Uri = Uri.Builder()
    .scheme("reminder-alarm")
    .authority("occurrence")
    .appendPath(alarmKey)
    .build()

  private fun showUri(alarmKey: String): Uri = Uri.Builder()
    .scheme("reminder-alarm")
    .authority("show")
    .appendPath(alarmKey)
    .build()

  private fun identityOnlySpec(alarmKey: String): AlarmOccurrenceSpec? {
    val parts = alarmKey.split(':')
    if (parts.size !in 4..5 || parts[0] != "reminder") return null
    val reminderId = parts[1].toLongOrNull() ?: return null
    val scheduledDate = parts[2]
    val kind = when (parts[3]) {
      "daily" -> AlarmOccurrenceSpec.KIND_DAILY
      "followup" -> AlarmOccurrenceSpec.KIND_FOLLOW_UP
      else -> return null
    }
    val sequence = if (kind == AlarmOccurrenceSpec.KIND_DAILY) 1 else parts.getOrNull(4)?.toIntOrNull() ?: return null
    return AlarmOccurrenceSpec(alarmKey, reminderId, scheduledDate, kind, sequence, 1L, "identity", "identity")
  }
}

data class ProductionScheduleOutcome(
  val scheduled: Boolean,
  val failureReason: String?,
)

data class RestorationSummary(
  val registryCount: Int,
  val restored: Int,
  val removedPast: Int,
  val failed: Int,
)
