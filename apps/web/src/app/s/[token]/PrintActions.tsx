"use client";

/**
 * "Download PDF" / "Print" (design §15 G2). Both open the browser's print
 * dialog — the PDF is generated fresh from the live page via the print
 * stylesheet ("still one tap away — for the GP's paper file").
 */
export default function PrintActions() {
  return (
    <div className="mt-[14px] flex gap-[10px] print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="cursor-pointer rounded-pill border border-ink px-4 py-2 text-[12px] font-semibold"
      >
        Download PDF
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="cursor-pointer rounded-pill border border-[rgba(28,38,32,0.2)] px-4 py-2 text-[12px] text-caption"
      >
        Print
      </button>
    </div>
  );
}
