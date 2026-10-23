package com.getcapacitor.myapp;

import static org.junit.Assert.*;

import android.content.Context;
import android.security.NetworkSecurityPolicy;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Instrumented test, which will execute on an Android device.
 *
 * @see <a href="http://d.android.com/tools/testing">Testing documentation</a>
 */
@RunWith(AndroidJUnit4.class)
public class ExampleInstrumentedTest {

    @Test
    public void useAppContext() throws Exception {
        // Context of the app under test.
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();

        assertEquals("org.fairwork.localpoc", appContext.getPackageName());
    }

    @Test
    public void debugCleartextIsRestrictedToExactLoopbackHost() {
        NetworkSecurityPolicy policy = NetworkSecurityPolicy.getInstance();
        assertTrue(policy.isCleartextTrafficPermitted("localhost"));
        assertFalse(policy.isCleartextTrafficPermitted("localhost.example.com"));
        assertFalse(policy.isCleartextTrafficPermitted("api.example.com"));
        assertFalse(policy.isCleartextTrafficPermitted("192.168.1.2"));
        assertFalse(policy.isCleartextTrafficPermitted("10.0.2.2"));
    }
}
