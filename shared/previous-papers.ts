export type PreviousPaperSession = {
  id: string;
  label: string;
  year: number;
  term: "May" | "November";
  makeup: boolean;
};

export type PreviousPaper = { id: string; name: string; viewUrl: string; downloadUrl: string };

const previousPaperSessionRows: Array<[string, string, number, "May" | "November", boolean]> = [
  ["1py8IGO_sNeYgajnJk6vy0ZTCcV-j3Q6Q", "May 2013", 2013, "May", false], ["13MCtBVU6MWiCcf15gmdYZtMo6YIlXv4m", "November 2013", 2013, "November", false],
  ["1IZHoRc4wr1q3JKxP-lYH05CQyC9CzmYm", "May 2014", 2014, "May", false], ["1HCgF1W9oBEgFnbYkAOBMXnC5DCIawtDv", "November 2014", 2014, "November", false],
  ["1gKRXxg2MdqjEf0nwLxxPcQ8Jv2_Rty_j", "May 2015", 2015, "May", false], ["1e-4vxLOsF5YtfH6AK0ArzVtYXWvJ4QTU", "November 2015", 2015, "November", false],
  ["13Z6JJjDzwB1IkUnrTX7IkcNbqusz8Vjl", "May 2016", 2016, "May", false], ["18dw5bm0NMDo3NS_E9kJLC3aNGspbXm-z", "November 2016", 2016, "November", false],
  ["1r3NlwlvSD5j7XRfLeNUw3Bk0GmKPU7nq", "May 2017", 2017, "May", false], ["1ht6i3Xay8njX3zidqGWnkLrnhKWv5GyB", "November 2017", 2017, "November", false],
  ["1U8DE4mzC8GDPailf706H6yI6Sotayxvx", "May 2018", 2018, "May", false], ["1DDiS4zuZWEWciSGDjzn40t6LXKweQA8D", "November 2018", 2018, "November", false],
  ["1jsWeKxF6-5L-88snuhXdK3YqH7_5utZB", "May 2019", 2019, "May", false], ["1nHYLcQcKFTAbl73ByqKc7lL6tIMMcaz0", "November 2019", 2019, "November", false],
  ["1tSajo-ep5z4dFDmbdWU9sYDNPddmnz45", "November 2020", 2020, "November", false],
  ["1Sd_BehGiibgsQrpAoki4O0WTH39fnjwb", "May 2021", 2021, "May", false], ["1KTsdbyhOP79sFdLW-72630PyoQ9XU3UO", "November 2021", 2021, "November", false],
  ["1RrNrAQjHrDBBPngI-6vwdhbCkpWK4npf", "May 2022", 2022, "May", false], ["18he5n2Lk-rRGm3anCH-PYXpXk4yjBsDp", "Makeup · May 2022", 2022, "May", true], ["1fiwQAhuVSTiCcrywbNZqZD63S4OgrcXT", "November 2022", 2022, "November", false], ["1jXHxAcJq8qNtjuW8YXY-cNd1OSxvBxDy", "Makeup · November 2022", 2022, "November", true],
  ["12zlzuN-8PnJqF0W9ujUge-5Rg9_hwAFa", "May 2023", 2023, "May", false], ["1oOcj9DoufGnq2dG2Vfl72eC456xHZZt1", "Makeup · May 2023", 2023, "May", true], ["1HF_ThB2z1L_IcaePC0BRZ_qw4DwKBMYC", "November 2023", 2023, "November", false], ["1IRfXz75zO2IgLMVeowdFn11zczXnBznU", "Makeup · November 2023", 2023, "November", true],
  ["1-ejwgx8No0umWLv9KH5vlHfYTfwA9r-4", "May 2024", 2024, "May", false], ["1W-xcHyOyTRHWYulgkC-XqR5SL3hSBHIj", "Makeup · May 2024", 2024, "May", true], ["1G0GbKPN0oWlgXT4Lbukt-p58Zwny_kan", "November 2024", 2024, "November", false], ["1LBjMTooTYVCBX78idPgrHfIsjqpmLWwC", "Makeup · November 2024", 2024, "November", true],
  ["1xUqKfe8uVeYh-yxzOAIJReelVVGGkSAF", "May 2025", 2025, "May", false], ["1p9p79CFGPnVyT03vI1VfeX3SFfywjo1O", "Makeup · May 2025", 2025, "May", true], ["1BndBZ3VJgEIBRldbdh-COmh4Tvu0000L", "November 2025", 2025, "November", false], ["1sTQuhpZjkHU4wHuTvbkrGsdX80v9OC0Y", "Makeup · November 2025", 2025, "November", true],
];

export const PREVIOUS_PAPER_SESSIONS: PreviousPaperSession[] = previousPaperSessionRows.map(([id, label, year, term, makeup]) => ({ id, label, year, term, makeup }));

export function toGoogleDrivePaperLinks(id: string) {
  return { viewUrl: `https://drive.google.com/file/d/${id}/view`, downloadUrl: `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t` };
}
