package expo.modules.reminderalarm

import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * Derived scheduling/delivery state supplied by TypeScript.
 *
 * This is deliberately not a reminder record and must never be treated as
 * authoritative for enabled, archived, taken, or history state.
 */
data class AlarmOccurrenceSpec(
  val alarmKey: String,
  val reminderId: Long,
  val scheduledDate: String,
  val kind: String,
  val sequence: Int,
  val triggerAtMillis: Long,
  val title: String,
  val body: String,
  val vibrate: Boolean = true,
) {
  fun toMap(): Map<String, Any> = mapOf(
    "alarmKey" to alarmKey,
    "reminderId" to reminderId.toDouble(),
    "scheduledDate" to scheduledDate,
    "kind" to kind,
    "sequence" to sequence,
    "triggerAtMillis" to triggerAtMillis.toDouble(),
    "title" to title,
    "body" to body,
    "vibrate" to vibrate,
  )

  fun toJson(): JSONObject = JSONObject()
    .put("alarmKey", alarmKey)
    .put("reminderId", reminderId)
    .put("scheduledDate", scheduledDate)
    .put("kind", kind)
    .put("sequence", sequence)
    .put("triggerAtMillis", triggerAtMillis)
    .put("title", title)
    .put("body", body)
    .put("vibrate", vibrate)

  companion object {
    const val KIND_DAILY = "daily"
    const val KIND_FOLLOW_UP = "follow_up"

    fun alarmKey(reminderId: Long, scheduledDate: String, kind: String, sequence: Int): String =
      if (kind == KIND_DAILY) {
        "reminder:$reminderId:$scheduledDate:daily"
      } else {
        "reminder:$reminderId:$scheduledDate:followup:$sequence"
      }

    fun fromMap(raw: Map<String, Any?>): AlarmOccurrenceParseResult {
      val reminderId = numberAsLong(raw["reminderId"])
        ?: return AlarmOccurrenceParseResult(error = "invalid_reminder_id")
      val sequence = numberAsLong(raw["sequence"])?.takeIf { it in 1..Int.MAX_VALUE }?.toInt()
        ?: return AlarmOccurrenceParseResult(error = "invalid_sequence")
      val triggerAtMillis = numberAsLong(raw["triggerAtMillis"])
        ?: return AlarmOccurrenceParseResult(error = "invalid_trigger_time")
      val spec = AlarmOccurrenceSpec(
        alarmKey = raw["alarmKey"] as? String ?: "",
        reminderId = reminderId,
        scheduledDate = raw["scheduledDate"] as? String ?: "",
        kind = raw["kind"] as? String ?: "",
        sequence = sequence,
        triggerAtMillis = triggerAtMillis,
        title = raw["title"] as? String ?: "",
        body = raw["body"] as? String ?: "",
        vibrate = raw["vibrate"] as? Boolean ?: true,
      )
      return validate(spec, requireFuture = true)
    }

    fun fromJson(json: JSONObject): AlarmOccurrenceSpec? = try {
      val spec = AlarmOccurrenceSpec(
        alarmKey = json.getString("alarmKey"),
        reminderId = json.getLong("reminderId"),
        scheduledDate = json.getString("scheduledDate"),
        kind = json.getString("kind"),
        sequence = json.getInt("sequence"),
        triggerAtMillis = json.getLong("triggerAtMillis"),
        title = json.getString("title"),
        body = json.getString("body"),
        vibrate = json.optBoolean("vibrate", true),
      )
      validate(spec, requireFuture = false).spec
    } catch (_: Exception) {
      null
    }

    private fun validate(spec: AlarmOccurrenceSpec, requireFuture: Boolean): AlarmOccurrenceParseResult {
      if (spec.reminderId == 0L) return AlarmOccurrenceParseResult(error = "invalid_reminder_id")
      if (!isValidDate(spec.scheduledDate)) return AlarmOccurrenceParseResult(error = "invalid_scheduled_date")
      if (spec.kind != KIND_DAILY && spec.kind != KIND_FOLLOW_UP) {
        return AlarmOccurrenceParseResult(error = "invalid_kind")
      }
      if ((spec.kind == KIND_DAILY && spec.sequence != 1) ||
        (spec.kind == KIND_FOLLOW_UP && spec.sequence < 2)
      ) {
        return AlarmOccurrenceParseResult(error = "invalid_sequence")
      }
      val expectedKey = alarmKey(spec.reminderId, spec.scheduledDate, spec.kind, spec.sequence)
      if (spec.alarmKey != expectedKey || spec.alarmKey.length > 512) {
        return AlarmOccurrenceParseResult(error = "invalid_alarm_key")
      }
      if (spec.triggerAtMillis <= 0L || (requireFuture && spec.triggerAtMillis <= System.currentTimeMillis())) {
        return AlarmOccurrenceParseResult(error = "invalid_trigger_time")
      }
      if (spec.title.isBlank() || spec.title.length > 200) {
        return AlarmOccurrenceParseResult(error = "invalid_title")
      }
      if (spec.body.isBlank() || spec.body.length > 1000) {
        return AlarmOccurrenceParseResult(error = "invalid_body")
      }
      return AlarmOccurrenceParseResult(spec = spec)
    }

    private fun numberAsLong(value: Any?): Long? {
      val number = value as? Number ?: return null
      val doubleValue = number.toDouble()
      if (!doubleValue.isFinite() || doubleValue % 1.0 != 0.0) return null
      if (doubleValue < Long.MIN_VALUE.toDouble() || doubleValue > Long.MAX_VALUE.toDouble()) return null
      return doubleValue.toLong()
    }

    private fun isValidDate(value: String): Boolean {
      if (!DATE_PATTERN.matches(value)) return false
      return try {
        SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { isLenient = false }.parse(value) != null
      } catch (_: Exception) {
        false
      }
    }

    private val DATE_PATTERN = Regex("\\d{4}-\\d{2}-\\d{2}")
  }
}

data class AlarmOccurrenceParseResult(
  val spec: AlarmOccurrenceSpec? = null,
  val error: String? = null,
)
