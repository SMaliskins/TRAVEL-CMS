/**
 * Test Air Baltic invoice parser with sample PDF text
 */
import { parseFlightBooking } from "../lib/flights/airlineParsers.ts";

const sampleText = `Pasažieri
Ceļojums un cena
PVN ir 0% saskaņā ar Latvijas PVN likuma 46. panta 3.; 4.punktu.
* Maksa nav atlīdzināma biļetēm bez atmaksas iespējas, ja lidojums atcelts pēc pasažiera vēlēšanās.
** Maksa nav atlīdzināma, ja lidojums atcelts pēc pasažiera vēlēšanās biļetēm bez atmaksas iespējas, Economy FLEX biļetēm, daļēji izmantotām BUSINESS
biļetēm.
Pakalpojumu nodrošina
RĒĶINS
Rēķina numurs: 2621869522
Rezervācijas numurs: 9YOOTU
Rezervēšanas datums: 25.02.2026
Biļetes numurs
K-dze LARISA GURARIJA 657-2423595985
K-dze IRINA SOMOVA 657-2423595986
S 09/05 15:30 Rīga 19:15 Antālija BT715 Economy FLEX, P
O 19/05 20:25 Antālija 00:15 Rīga BT716 Economy FLEX, K
Pieaugušais/-ie
Cena EUR 480.00
Nodokļi EUR 58.64
Degvielas un vides izmaksu piemaksa * EUR 140.00
Biļetes izdošanas pakalpojums ** EUR 3.32
Kopā EUR 681.96
AIR BALTIC CORPORATION A/S
Tehnikas 3
Starptautiskā lidosta "Rīga
Marupes pag., Rīga LV-1053, Latvija
VAT Reg. No. LV40003245752
Šis ir informatīvs rēķins, un tas nav jāapmaksā.
Rēķins nosūtīts: 25.02.26 19:15`;

const result = parseFlightBooking(sampleText);
console.log(JSON.stringify(result, null, 2));

// Assertions
if (!result) {
  console.error("FAIL: parseFlightBooking returned null");
  process.exit(1);
}
if (result.segments.length !== 2) {
  console.error(`FAIL: expected 2 segments, got ${result.segments.length}`);
  process.exit(1);
}
if (result.booking.bookingRef !== "9YOOTU") {
  console.error(`FAIL: expected bookingRef 9YOOTU, got ${result.booking.bookingRef}`);
  process.exit(1);
}
if (result.booking.totalPrice !== 681.96) {
  console.error(`FAIL: expected totalPrice 681.96, got ${result.booking.totalPrice}`);
  process.exit(1);
}
if (result.segments[0].flightNumber !== "BT715" || result.segments[0].departure !== "RIX" || result.segments[0].arrival !== "AYT") {
  console.error("FAIL: segment 1 expected BT715 RIX→AYT", result.segments[0]);
  process.exit(1);
}
if (result.segments[1].flightNumber !== "BT716" || result.segments[1].departure !== "AYT" || result.segments[1].arrival !== "RIX") {
  console.error("FAIL: segment 2 expected BT716 AYT→RIX", result.segments[1]);
  process.exit(1);
}
console.log("PASS: All assertions ok");
