package com.runflow.app.macrobenchmark

import android.os.Trace
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Direction
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.Until

/**
 * Synthetic-only inputs and semantic UI helpers used by the Macrobenchmark module.
 *
 * The target app is never opened through a user profile, database, or imported file.
 * The fixture objects exist only in the benchmark process and are deliberately not
 * written to the app's storage.
 */
object BenchmarkJourneys {
    const val TARGET_PACKAGE = "com.runflow.app.benchmark"
    const val DEFAULT_ITERATIONS = 20
    const val SYNTHETIC_ACTIVITY_COUNT = 1_000
    const val SYNTHETIC_FLYOVER_POINT_COUNT = 50_000
    const val WAIT_TIMEOUT_MS = 5_000L

    data class SyntheticActivityFixture(
        val id: String,
        val title: String,
        val pointCount: Int,
    )

    /** Deterministic fixture metadata; no real RunFlow record is read or written. */
    val syntheticActivities: List<SyntheticActivityFixture> =
        (1..SYNTHETIC_ACTIVITY_COUNT).map { index ->
            SyntheticActivityFixture(
                id = "synthetic-activity-%04d".format(index),
                title = "Benchmark Activity %04d".format(index),
                pointCount = 50 + (index % 250),
            )
        }

    val syntheticFlyoverFixture = SyntheticActivityFixture(
        id = "synthetic-flyover-50000",
        title = "Benchmark Flyover 50000",
        pointCount = SYNTHETIC_FLYOVER_POINT_COUNT,
    )

    private val activitiesLabels = listOf("Atividades", "Activities")
    private val mapLabels = listOf("Mapa 2D", "2D Map", "Mapa", "Map", "Route map")
    private val flyoverLabels = listOf("Flyover", "Flyover 3D", "3D Flyover", "Visualização 3D", "3D view")
    private val heatmapLabels = listOf("🔥 Mapa de Calor", "🔥 Heatmap", "Heatmap", "Mapa de calor")

    fun waitForTargetApp(device: UiDevice): Boolean =
        device.wait(Until.hasObject(By.pkg(TARGET_PACKAGE)), WAIT_TIMEOUT_MS)

    fun openActivities(device: UiDevice): Boolean = tapSemantic(device, activitiesLabels)

    fun hasSyntheticActivity(device: UiDevice, index: Int = 0): Boolean {
        val fixture = syntheticActivities.getOrNull(index) ?: return false
        return device.wait(Until.hasObject(By.text(fixture.title)), WAIT_TIMEOUT_MS)
    }

    fun openMap(device: UiDevice): Boolean = tapSemantic(device, mapLabels)

    fun openFirstSyntheticActivity(device: UiDevice): Boolean {
        val fixture = syntheticActivities.first()
        return hasSyntheticActivity(device) && tapSemantic(device, listOf(fixture.title))
    }

    fun openSyntheticFlyoverActivity(device: UiDevice): Boolean {
        val fixture = syntheticFlyoverFixture
        return device.wait(Until.hasObject(By.text(fixture.title)), WAIT_TIMEOUT_MS) &&
            tapSemantic(device, listOf(fixture.title))
    }

    fun openFlyover(device: UiDevice): Boolean = tapSemantic(device, flyoverLabels)

    fun openHeatmap(device: UiDevice): Boolean = tapSemantic(device, heatmapLabels)

    /** Scrolls a semantic scroll container; no screen coordinates are used. */
    fun scrollSyntheticActivities(device: UiDevice): Boolean {
        val scrollable = device.findObject(By.scrollable(true)) ?: return false
        if (!hasSyntheticActivity(device)) return false
        scrollable.scrollUntil(
            Direction.DOWN,
            Until.hasObject(By.text(syntheticActivities.last().title)),
        )
        device.waitForIdle()
        return hasSyntheticActivity(device, syntheticActivities.lastIndex)
    }

    /** Rotates through UiAutomator orientation APIs; no screen coordinates are used. */
    fun rotateLeft(device: UiDevice): Boolean = runCatching {
        device.unfreezeRotation()
        device.setOrientationLeft()
        device.waitForIdle()
        true
    }.getOrDefault(false)

    fun restoreNaturalOrientation(device: UiDevice): Boolean = runCatching {
        device.setOrientationNatural()
        device.waitForIdle()
        true
    }.getOrDefault(false)

    /** Adds semantic start/end trace markers without touching target data. */
    inline fun <T> traceSyntheticJourney(name: String, block: () -> T): T {
        val marker = "RunFlowBenchmark.synthetic.$name"
        Trace.beginSection("$marker.start")
        return try {
            block()
        } finally {
            Trace.endSection()
            Trace.beginSection("$marker.end")
            Trace.endSection()
        }
    }

    private fun tapSemantic(device: UiDevice, labels: List<String>): Boolean {
        val target = labels.asSequence()
            .mapNotNull { label ->
                device.findObject(By.text(label)) ?: device.findObject(By.desc(label))
            }
            .firstOrNull()
            ?: return false
        var clickableTarget = target
        while (!clickableTarget.isClickable) {
            clickableTarget = clickableTarget.parent ?: break
        }
        clickableTarget.click()
        device.waitForIdle()
        return true
    }
}
