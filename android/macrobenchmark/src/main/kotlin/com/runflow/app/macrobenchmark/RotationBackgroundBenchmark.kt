package com.runflow.app.macrobenchmark

import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@LargeTest
@RunWith(AndroidJUnit4::class)
class RotationBackgroundBenchmark {
    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    @Test
    fun rotateAndResumeFromBackground() = benchmarkRule.measureRepeated(
        packageName = BenchmarkJourneys.TARGET_PACKAGE,
        metrics = listOf(FrameTimingMetric()),
        iterations = BenchmarkJourneys.DEFAULT_ITERATIONS,
        setupBlock = {
            pressHome()
        },
    ) {
        startActivityAndWait()
        val device = device()
        check(BenchmarkJourneys.waitForTargetApp(device)) {
            "RunFlow benchmark target did not become visible"
        }
        try {
            BenchmarkJourneys.traceSyntheticJourney("rotation-background") {
                check(BenchmarkJourneys.rotateLeft(device)) {
                    "RunFlow rotation could not be applied"
                }
                device.pressHome()
                startActivityAndWait()
                check(BenchmarkJourneys.waitForTargetApp(device)) {
                    "RunFlow benchmark target did not resume from background"
                }
            }
        } finally {
            BenchmarkJourneys.restoreNaturalOrientation(device)
        }
    }

    private fun device(): UiDevice =
        UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
}
