package expo.modules.reminderalarm

import android.content.Context
import org.json.JSONArray

/**
 * A rebuildable derived cache of alarms already requested by TypeScript.
 * SQLite/Zustand remain authoritative; this cache exists only for Android
 * reconstruction while JavaScript is unavailable.
 */
object NativeAlarmRegistry {
  private const val PREFERENCES_NAME = "reminder_alarm_registry_v1"
  private const val OCCURRENCES_KEY = "occurrences"
  private val lock = Any()

  fun get(context: Context, alarmKey: String): AlarmOccurrenceSpec? =
    all(context).firstOrNull { it.alarmKey == alarmKey }

  fun all(context: Context): List<AlarmOccurrenceSpec> = synchronized(lock) {
    val serialized = preferences(context).getString(OCCURRENCES_KEY, null) ?: return@synchronized emptyList()
    try {
      val array = JSONArray(serialized)
      buildList {
        for (index in 0 until array.length()) {
          AlarmOccurrenceSpec.fromJson(array.optJSONObject(index) ?: continue)?.let(::add)
        }
      }.sortedBy { it.alarmKey }
    } catch (_: Exception) {
      emptyList()
    }
  }

  fun put(context: Context, spec: AlarmOccurrenceSpec): Boolean = synchronized(lock) {
    val entries = all(context).associateBy { it.alarmKey }.toMutableMap()
    entries[spec.alarmKey] = spec
    write(context, entries.values.sortedBy { it.alarmKey })
  }

  fun remove(context: Context, alarmKey: String): Boolean = synchronized(lock) {
    val entries = all(context).associateBy { it.alarmKey }.toMutableMap()
    val removed = entries.remove(alarmKey) != null
    if (!removed) return@synchronized false
    write(context, entries.values.sortedBy { it.alarmKey })
  }

  fun clear(context: Context): Boolean = synchronized(lock) {
    preferences(context).edit().remove(OCCURRENCES_KEY).commit()
  }

  private fun write(context: Context, entries: Collection<AlarmOccurrenceSpec>): Boolean {
    val array = JSONArray()
    entries.forEach { array.put(it.toJson()) }
    return preferences(context).edit().putString(OCCURRENCES_KEY, array.toString()).commit()
  }

  private fun preferences(context: Context) =
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
}
