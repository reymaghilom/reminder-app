package expo.modules.reminderalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

object ProductionAlarmScheduler {
  const val PRODUCTION_REQUEST_CODE = 920000
  const val PRODUCTION_SHOW_REQUEST_CODE = 920001
  private const val TAG = "ReminderAlarm"

  /** Must match FOLLOW_UP_HORIZON_DAYS in src/utils/repeatReminders.ts (the window TypeScript keeps scheduled). */
  private const val ROLL_FORWARD_DAYS = 14

  /** Alarms missed by less than this (e.g. during a slow boot) still ring on restore; older ones are dropped. */
  private const val MISSED_ALARM_GRACE_MILLIS = 2 * 60 * 60 * 1000L

  /**
   * Keeps a daily reminder going while the app is not opened: when a daily occurrence fires, the same
   * reminder is armed again [ROLL_FORWARD_DAYS] later at the same local wall-clock time. This mirrors
   * the old repeating Expo daily notification; the next app sync replaces it with SQLite-derived data.
   * Follow-ups are not rolled because they depend on taken state, which only TypeScript knows.
   */
  fun rollDailyForward(
    context: Context,
    fired: AlarmOccurrenceSpec,
    zone: TimeZone = TimeZone.getDefault(),
  ): Unit = synchronized(NativeAlarmRegistry.lock) {
    if (fired.kind != AlarmOccurrenceSpec.KIND_DAILY) return
    val next = Calendar.getInstance(zone).apply {
      // Start from the intended local time when known, so a timezone change does not shift the chain.
      timeInMillis = fired.inZone(zone).triggerAtMillis
      add(Calendar.DAY_OF_MONTH, ROLL_FORWARD_DAYS)
    }
    val scheduledDate = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = zone }.format(next.time)
    val alarmKey = AlarmOccurrenceSpec.alarmKey(fired.reminderId, scheduledDate, AlarmOccurrenceSpec.KIND_DAILY, 1)
    if (NativeAlarmRegistry.get(context, alarmKey) != null) return
    val outcome = scheduleLocked(
      context,
      fired.copy(
        alarmKey = alarmKey,
        scheduledDate = scheduledDate,
        triggerAtMillis = next.timeInMillis,
        localDateTime = fired.localDateTime?.let { AlarmOccurrenceSpec.formatLocal(next.timeInMillis, zone) },
      ),
      persistAfterSuccess = true,
    )
    Log.i(TAG, "PRODUCTION_ALARM_ROLLED from=${fired.alarmKey} to=$alarmKey scheduled=${outcome.scheduled} reason=${outcome.failureReason}")
  }

  fun schedule(
    context: Context,
    spec: AlarmOccurrenceSpec,
    persistAfterSuccess: Boolean,
  ): ProductionScheduleOutcome = synchronized(NativeAlarmRegistry.lock) {
    scheduleLocked(context, spec, persistAfterSuccess)
  }

  private fun scheduleLocked(
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
    } catch (_: IllegalStateException) {
      // Android caps concurrent alarms per app (500 on API 31+).
      operation.cancel()
      ProductionScheduleOutcome(false, "alarm_limit_reached")
    }
  }

  fun cancel(context: Context, alarmKey: String, removeFromRegistry: Boolean = true): Boolean =
    synchronized(NativeAlarmRegistry.lock) { cancelLocked(context, alarmKey, removeFromRegistry) }

  private fun cancelLocked(context: Context, alarmKey: String, removeFromRegistry: Boolean): Boolean {
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

  /**
   * Re-arms every registered alarm. Alarms are first moved back to their intended local wall-clock time
   * in [zone] (the timezone may have changed, even while the phone was off); alarms that then fall in
   * the past are handled as missed.
   */
  fun restoreRegistered(
    context: Context,
    reason: String,
    zone: TimeZone = TimeZone.getDefault(),
  ): RestorationSummary = synchronized(NativeAlarmRegistry.lock) {
    val stored = NativeAlarmRegistry.all(context)
    val entries = stored.map { it.inZone(zone) }
    val moved = entries.zip(stored).count { (after, before) -> after.triggerAtMillis != before.triggerAtMillis }
    if (moved > 0) {
      NativeAlarmRegistry.replaceAll(context, entries)
      Log.i(TAG, "PRODUCTION_ALARM_RETIMED zone=${zone.id} registry=${stored.size} moved=$moved")
    }
    val now = System.currentTimeMillis()
    val (past, future) = entries.partition { it.triggerAtMillis <= now }
    var restored = 0
    var failed = 0

    past.forEach { cancelLocked(context, it.alarmKey, removeFromRegistry = true) }
    // One late alert per dose, even if its daily alarm and several follow-ups were all missed.
    val late = past
      .filter { now - it.triggerAtMillis <= MISSED_ALARM_GRACE_MILLIS }
      .groupBy { it.reminderId to it.scheduledDate }
      .values
      .mapNotNull { dose -> dose.maxByOrNull { it.triggerAtMillis } }
    for (spec in late) {
      try {
        ProductionAlarmReceiver().postNotification(context, spec)
        Log.i(TAG, "PRODUCTION_ALARM_LATE alarmKey=${spec.alarmKey} missedByMillis=${now - spec.triggerAtMillis}")
      } catch (error: RuntimeException) {
        Log.w(TAG, "Unable to deliver missed alarm: ${spec.alarmKey}", error)
      }
    }
    // Keep each daily chain going even when the missed occurrence itself is too old to ring.
    past.filter { it.kind == AlarmOccurrenceSpec.KIND_DAILY }.forEach { rollDailyForward(context, it, zone) }

    for (spec in future) {
      val outcome = scheduleLocked(context, spec, persistAfterSuccess = false)
      if (outcome.scheduled) restored += 1 else failed += 1
    }
    val summary = RestorationSummary(entries.size, restored, past.size, late.size, failed)
    Log.i(
      TAG,
      "PRODUCTION_ALARM_RESTORE reason=$reason registry=${summary.registryCount} " +
        "restored=${summary.restored} removedPast=${summary.removedPast} deliveredLate=${summary.deliveredLate} " +
        "failed=${summary.failed}",
    )
    summary
  }

  /**
   * Makes the native alarms for [scopeReminderIds] (or every reminder when [replaceAll]) exactly match
   * [specs], which TypeScript derived from SQLite. Every desired alarm is re-issued, so alarms the OS
   * dropped while the registry still listed them are recovered. The registry is written once.
   */
  fun synchronize(
    context: Context,
    specs: List<AlarmOccurrenceSpec>,
    scopeReminderIds: Set<Long>,
    replaceAll: Boolean,
  ): SynchronizationSummary = synchronized(NativeAlarmRegistry.lock) {
    if (!canScheduleExactAlarms(context)) {
      return@synchronized SynchronizationSummary(0, 0, specs.map { it.alarmKey to "exact_alarm_access_required" }, false)
    }
    val inScope = { spec: AlarmOccurrenceSpec -> replaceAll || spec.reminderId in scopeReminderIds }
    val existing = NativeAlarmRegistry.all(context)
    val desiredKeys = specs.mapTo(HashSet()) { it.alarmKey }
    val stale = existing.filter { inScope(it) && it.alarmKey !in desiredKeys }
    stale.forEach { cancelLocked(context, it.alarmKey, removeFromRegistry = false) }

    val scheduled = ArrayList<AlarmOccurrenceSpec>(specs.size)
    val failures = ArrayList<Pair<String, String>>()
    for (spec in specs) {
      if (!inScope(spec)) {
        failures += spec.alarmKey to "out_of_scope"
        continue
      }
      val outcome = scheduleLocked(context, spec, persistAfterSuccess = false)
      if (outcome.scheduled) scheduled += spec else failures += spec.alarmKey to (outcome.failureReason ?: "scheduling_failed")
    }

    val kept = existing.filter { !inScope(it) }
    if (!NativeAlarmRegistry.replaceAll(context, kept + scheduled)) {
      scheduled.forEach { cancelLocked(context, it.alarmKey, removeFromRegistry = false) }
      return@synchronized SynchronizationSummary(0, stale.size, specs.map { it.alarmKey to "registry_write_failed" }, true)
    }
    Log.i(
      TAG,
      "PRODUCTION_ALARM_SYNC replaceAll=$replaceAll scope=${scopeReminderIds.size} desired=${specs.size} " +
        "scheduled=${scheduled.size} cancelled=${stale.size} failed=${failures.size}",
    )
    SynchronizationSummary(scheduled.size, stale.size, failures, true)
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

data class SynchronizationSummary(
  val scheduled: Int,
  val cancelled: Int,
  val failures: List<Pair<String, String>>,
  val exactAlarmAccess: Boolean,
)

data class RestorationSummary(
  val registryCount: Int,
  val restored: Int,
  val removedPast: Int,
  val deliveredLate: Int,
  val failed: Int,
)
