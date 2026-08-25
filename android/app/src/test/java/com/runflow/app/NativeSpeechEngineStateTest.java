package com.runflow.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class NativeSpeechEngineStateTest {
    @Test
    public void stopDuringInitializationReleasesPendingAndAllowsRetry() {
        NativeSpeechEngineState<Object> state = new NativeSpeechEngineState<>();
        Object request = new Object();

        state.beginInitialization(request);

        assertSame(request, state.cancelInitialization());
        assertTrue(state.needsInitialization());
        assertFalse(state.isInitialized());
    }

    @Test
    public void initializationFailureReleasesPendingAndAllowsRetry() {
        NativeSpeechEngineState<Object> state = new NativeSpeechEngineState<>();
        Object request = new Object();

        state.beginInitialization(request);

        assertSame(request, state.failInitialization());
        assertTrue(state.needsInitialization());
        assertFalse(state.isInitialized());
    }

    @Test
    public void teardownClearsInitializedState() {
        NativeSpeechEngineState<Object> state = new NativeSpeechEngineState<>();
        state.beginInitialization(new Object());
        state.completeInitialization();

        state.teardown();

        assertTrue(state.needsInitialization());
        assertFalse(state.isInitialized());
    }

    @Test
    public void staleInitializationGenerationCannotMutateRetry() {
        NativeSpeechEngineState<Object> state = new NativeSpeechEngineState<>();

        state.beginInitialization(new Object());
        long firstGeneration = state.currentGeneration();
        state.cancelInitialization();
        state.teardown();

        state.beginInitialization(new Object());
        long secondGeneration = state.currentGeneration();

        assertFalse(state.isCurrentInitialization(firstGeneration));
        assertTrue(state.isCurrentInitialization(secondGeneration));
    }
}
