import Foundation

/// Formats the blood-draw date a member confirms on the OCR/photo/PDF confirm
/// screen into the server's `takenAt` (YYYY-MM-DD).
///
/// WHY THIS MATTERS: real OCR never reads the draw date, so the client must
/// collect it. The confirm route stamps each reading's `takenAt` from this, and
/// the RCV/baseline engine sorts readings by `takenAt` and compares each to its
/// chronologically-prior neighbour — a backfilled lab report misdated to "today"
/// would sort to the end of the timeline and compute its delta against the wrong
/// reading. So the member's chosen date, not upload day, must flow through here.
enum BloodworkDrawDate {
    /// The picker's `takenAt` string. A blood draw is today or earlier, so any
    /// future date is clamped to `now` (belt-and-braces with the DatePicker's
    /// `...Date()` range). Locale/format match `DataV3Format.isoDay`.
    static func takenAt(from date: Date, now: Date = Date(), calendar: Calendar = .current) -> String {
        let clamped = min(date, now)
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_IE")
        f.calendar = calendar
        f.timeZone = calendar.timeZone
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: clamped)
    }
}
