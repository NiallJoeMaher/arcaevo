"use client";

import { useState } from "react";
import type { HelpGroup } from "@/content/help";

/**
 * FAQ accordion per Help.dc.html: ONE item open at a time across the whole
 * page (prototype state = { open: "0-0" }), +/− sign swap on toggle.
 */
export default function HelpAccordion({ groups }: { groups: HelpGroup[] }) {
  const [openId, setOpenId] = useState<string | null>("0-0");

  const toggle = (id: string) =>
    setOpenId((current) => (current === id ? null : id));

  return (
    <>
      {groups.map((g, gi) => (
        <div key={g.title} className="mb-10">
          <h2
            data-reveal=""
            className="mb-[14px] mt-0 font-serif text-[26px] font-normal tracking-[-0.01em]"
          >
            {g.title}
          </h2>
          <div className="border-t border-hairline-mid">
            {g.items.map((it, ii) => {
              const id = `${gi}-${ii}`;
              const open = openId === id;
              const panelId = `help-panel-${id}`;
              const buttonId = `help-button-${id}`;
              return (
                <div key={it.q} className="border-b border-hairline-mid">
                  <h3 className="m-0">
                    <button
                      type="button"
                      id={buttonId}
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => toggle(id)}
                      className="flex w-full cursor-pointer items-center justify-between gap-4 border-0 bg-transparent px-1 py-[18px] text-left font-sans text-ink"
                    >
                      <span className="text-base font-semibold">{it.q}</span>
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-xl text-caption"
                      >
                        {open ? "−" : "+"}
                      </span>
                    </button>
                  </h3>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    hidden={!open}
                  >
                    <p className="-mt-[6px] mb-0 max-w-[66ch] px-1 pb-[18px] pt-0 text-[14.5px] leading-[1.6] text-muted">
                      {it.a}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
