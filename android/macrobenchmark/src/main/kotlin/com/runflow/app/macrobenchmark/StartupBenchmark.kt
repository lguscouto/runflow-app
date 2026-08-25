package com.runflow.app.macrobenchmark

import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.StartupTimingMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.uiautomator.UiDevice
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@LargeTest
@RunWith(AndroidJUnit4::class)
class StartupBenchmark {
    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    @Test
    fun coldStartup() = measureStartup(StartupMode.COLD)

    @Test
    fun warmStartup() = measureStartup(StartupMode.WARM)

    @Test
    fun hotStartup() = measureStartup(StartupMode.HOT)

    private fun measureStartup(startupMode: StartupMode) =
        benchmarkRule.measureRepeated(
            packageName = BenchmarkJourneys.TARGET_PACKAGE,
            metrics = listOf(StartupTimingMetric(), FrameTimingMetric()),
            iterations = BenchmarkJourneys.DEFAULT_ITERATIONS,
            startupMode = startupMode,
        ) {
            BenchmarkJourneys.traceSyntheticJourney("startup-${startupMode.name.lowercase()}") {
                startActivityAndWait()
                check(BenchmarkJourneys.waitForTargetApp(device())) {
                    "RunFlow benchmark target did not become visible"
                }
            }
        }

    private fun device(): UiDevice =
        UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
}
