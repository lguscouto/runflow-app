package com.runflow.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.io.File;
import javax.xml.parsers.DocumentBuilderFactory;
import org.junit.Test;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

public class BenchmarkProfileableContractTest {

    private static final String ANDROID_NAMESPACE = "http://schemas.android.com/apk/res/android";

    @Test
    public void benchmarkManifestAllowsShellProfiling() throws Exception {
        File manifest = new File(System.getProperty("user.dir"), "src/benchmark/AndroidManifest.xml");
        assertTrue("Benchmark manifest must exist: " + manifest, manifest.isFile());

        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        Document document = factory.newDocumentBuilder().parse(manifest);
        NodeList profileableNodes = document.getElementsByTagName("profileable");

        assertEquals("Benchmark manifest must declare exactly one profileable element", 1, profileableNodes.getLength());
        Element profileable = (Element) profileableNodes.item(0);
        assertEquals(
                "true",
                profileable.getAttributeNS(ANDROID_NAMESPACE, "shell")
        );
    }
}
