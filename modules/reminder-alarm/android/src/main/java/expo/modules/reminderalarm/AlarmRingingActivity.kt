package expo.modules.reminderalarm

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.lang.ref.WeakReference
import java.text.DateFormat
import java.util.Date

/**
 * Full-screen alarm shown over the lock screen while a reminder rings (like Android Clock's alarm
 * screen). Built in plain Android views so it works without the React Native bundle.
 */
class AlarmRingingActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    showOverLockScreen()
    val spec = AlarmRingingService.currentSpec()
    if (spec == null) {
      finish()
      return
    }
    current = WeakReference(this)
    setContentView(buildLayout(spec))
  }

  override fun onDestroy() {
    if (current?.get() === this) current = null
    super.onDestroy()
  }

  /** Back only hides the screen; the alarm keeps ringing until Stop or Mark as taken (like Android Clock). */
  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    moveTaskToBack(true)
  }

  private fun showOverLockScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  private fun buildLayout(spec: AlarmOccurrenceSpec): LinearLayout {
    val background = Color.parseColor("#1F2A22")
    val accent = Color.parseColor("#7C9A7E")
    return LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(background)
      setPadding(dp(28), dp(48), dp(28), dp(48))
      addView(text(DateFormat.getTimeInstance(DateFormat.SHORT).format(Date()), 56f, Typeface.BOLD))
      addView(text(spec.title, 26f, Typeface.BOLD).apply { setPadding(0, dp(24), 0, dp(8)) })
      addView(text(spec.body, 17f, Typeface.NORMAL).apply { alpha = 0.85f })
      addView(button("Mark as taken", accent, Color.WHITE) { markTaken(spec) }.apply {
        layoutParams = buttonParams(top = dp(56))
      })
      addView(button("Stop", Color.TRANSPARENT, Color.WHITE, stroke = accent) { stop() }.apply {
        layoutParams = buttonParams(top = dp(14))
      })
    }
  }

  private fun markTaken(spec: AlarmOccurrenceSpec) {
    // Stop at once; the app then records the dose and clears the rest of this dose's alarms.
    // Detach first so the service does not finish this screen before the unlock + deep link complete.
    if (current?.get() === this) current = null
    AlarmRingingService.stopKeys(listOf(spec.alarmKey), markedTaken = true)
    dismissKeyguardThen { startActivity(ProductionAlarmReceiver.markTakenIntent(this, spec).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)) }
  }

  private fun stop() {
    AlarmRingingService.stopAll()
    finish()
  }

  private fun dismissKeyguardThen(action: () -> Unit) {
    val keyguard = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && keyguard?.isKeyguardLocked == true) {
      keyguard.requestDismissKeyguard(this, object : KeyguardManager.KeyguardDismissCallback() {
        override fun onDismissSucceeded() {
          action()
          finish()
        }
      })
    } else {
      action()
      finish()
    }
  }

  private fun text(value: String, sizeSp: Float, style: Int) = TextView(this).apply {
    text = value
    setTextColor(Color.WHITE)
    setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
    setTypeface(typeface, style)
    gravity = Gravity.CENTER
  }

  private fun button(label: String, fill: Int, textColor: Int, stroke: Int? = null, onClick: () -> Unit) = Button(this).apply {
    text = label
    isAllCaps = false
    setTextColor(textColor)
    setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
    background = GradientDrawable().apply {
      cornerRadius = dp(16).toFloat()
      setColor(fill)
      if (stroke != null) setStroke(dp(2), stroke)
    }
    setOnClickListener { onClick() }
  }

  private fun buttonParams(top: Int) = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(56)).apply {
    topMargin = top
  }

  private fun dp(value: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), resources.displayMetrics).toInt()

  companion object {
    private var current: WeakReference<AlarmRingingActivity>? = null

    fun finishIfShowing() {
      current?.get()?.finish()
    }
  }
}
