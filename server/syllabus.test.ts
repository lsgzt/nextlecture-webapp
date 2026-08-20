import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearOfficialSyllabusCacheForTests, getOfficialSyllabusDocument } from "./syllabus";

vi.mock("axios", () => ({ default: { get: vi.fn() } }));

describe("official syllabus document cache", () => {
  afterEach(() => {
    clearOfficialSyllabusCacheForTests();
    vi.clearAllMocks();
  });

  it("returns an official PDF as bounded base64 data and reuses the fresh cache", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: Buffer.from("%PDF-syllabus"), headers: { "content-type": "application/pdf" } } as never);
    const first = await getOfficialSyllabusDocument();
    const second = await getOfficialSyllabusDocument();

    expect(first).toMatchObject({ mimeType: "application/pdf", byteLength: 13 });
    expect(Buffer.from(first.base64, "base64").toString()).toBe("%PDF-syllabus");
    expect(second).toStrictEqual(first);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-PDF official source response", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: Buffer.from("not a PDF"), headers: { "content-type": "text/html" } } as never);
    await expect(getOfficialSyllabusDocument()).rejects.toThrow(/valid PDF/i);
  });
});
