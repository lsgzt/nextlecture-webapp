import { describe, expect, it } from "vitest";
import { parseGoogleDrivePapers } from "./previousPapers";

describe("Google Drive previous paper parser", () => {
  it("returns direct PDF links and ignores non-PDF Drive entries", () => {
    const papers = parseGoogleDrivePapers('<tr data-id="1a8ltKVpOKeETzR-MbosajRIckNuu-nBP"><td>PDF BSC-101 (15925).pdf Partagé Download</td></tr><tr data-id="1a8ltKVpOKeETzR-MbosajRIckNuu-nBP"><td>BSC-101 (15925).pdf</td></tr><tr data-id="folder-entry"><td>Notes</td></tr>');
    expect(papers).toEqual([{ id: "1a8ltKVpOKeETzR-MbosajRIckNuu-nBP", name: "BSC-101 (15925).pdf", viewUrl: "https://drive.google.com/file/d/1a8ltKVpOKeETzR-MbosajRIckNuu-nBP/view", downloadUrl: "https://drive.usercontent.google.com/download?id=1a8ltKVpOKeETzR-MbosajRIckNuu-nBP&export=download&confirm=t" }]);
  });
});
