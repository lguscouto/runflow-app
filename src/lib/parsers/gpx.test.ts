import { describe, expect, it } from "vitest";
import { parseGpx, parseTrackPoints } from "./gpx";

describe("GPX numeric safety", () => {
  it("filters invalid coordinates and non-finite telemetry", () => {
    const xml = `
      <trkpt lat="91" lon="-43.2"><ele>100</ele></trkpt>
      <trkpt lat="-22.9" lon="-43.2">
        <ele>Infinity</ele><time>2026-08-25T00:00:00Z</time>
        <gpxtpx:hr>Infinity</gpxtpx:hr><power>NaN</power><cad>Infinity</cad>
      </trkpt>
      <trkpt lat="-22.8999" lon="-43.2">
        <ele>101</ele><time>2026-08-25T00:00:01Z</time>
        <gpxtpx:hr>150</gpxtpx:hr><power>200</power><cad>80</cad>
      </trkpt>`;

    const points = parseTrackPoints(xml);

    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ lat: -22.9, lng: -43.2 });
    expect(points[0].elevation).toBeUndefined();
    expect(points[0].hr).toBeUndefined();
    expect(points[0].watts).toBeUndefined();
    expect(points[0].cadence).toBeUndefined();
  });

  it("does not preserve negative power from an imported track", () => {
    const xml = `
      <trkpt lat="-22.9" lon="-43.2"><time>2026-08-25T00:00:00Z</time><power>-10</power></trkpt>
      <trkpt lat="-22.8999" lon="-43.2"><time>2026-08-25T00:00:01Z</time><power>200</power></trkpt>`;

    const points = parseTrackPoints(xml);

    expect(points[0].watts).toBeUndefined();
    expect(points[1].watts).toBe(200);
  });

  it("drops finite but physically impossible telemetry values", () => {
    const xml = `
      <trkpt lat="-22.9" lon="-43.2">
        <ele>50000</ele><gpxtpx:hr>999</gpxtpx:hr><power>99999</power><cad>999</cad>
      </trkpt>
      <trkpt lat="-22.8999" lon="-43.2"><ele>101</ele></trkpt>`;

    const points = parseTrackPoints(xml);

    expect(points[0].elevation).toBeUndefined();
    expect(points[0].hr).toBeUndefined();
    expect(points[0].watts).toBeUndefined();
    expect(points[0].cadence).toBeUndefined();
  });

  it("rejects imported tracks whose timestamps go backwards", () => {
    const xml = `
      <trkpt lat="-22.9" lon="-43.2"><time>2026-08-25T00:00:02Z</time></trkpt>
      <trkpt lat="-22.8999" lon="-43.2"><time>2026-08-25T00:00:01Z</time></trkpt>`;

    expect(() => parseGpx(xml, "out-of-order.gpx")).toThrow(/ordem temporal/i);
  });

  it("rejects a backwards timestamp across a point without timestamp", () => {
    const xml = `
      <trkpt lat="-22.9" lon="-43.2"><time>2026-08-25T00:00:10Z</time></trkpt>
      <trkpt lat="-22.8999" lon="-43.2"></trkpt>
      <trkpt lat="-22.8998" lon="-43.2"><time>2026-08-25T00:00:05Z</time></trkpt>`;

    expect(() => parseGpx(xml, "out-of-order-gap.gpx")).toThrow(/ordem temporal/i);
  });
});