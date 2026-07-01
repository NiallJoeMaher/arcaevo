"use client";

import { useState } from "react";
import Link from "next/link";

const INPUT_CLASSES =
  "w-full rounded-[10px] border border-hairline-strong bg-white px-[13px] py-[11px] font-sans text-sm text-ink focus:border-forest focus:outline-none";

const LABEL_CLASSES = "mb-[6px] block text-xs font-semibold text-muted";

const TOPICS = [
  "Support with my account",
  "A question before I join",
  "Press & media",
  "Partnerships",
  "Data & privacy request",
];

export default function ContactForm() {
  const [sent, setSent] = useState(false);

  return (
    <div className="rounded-card-lg border border-hairline-soft bg-surface p-8">
      <h2 className="mb-5 mt-0 text-xl font-bold">Send us a message</h2>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSent(true);
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="contact-first-name" className={LABEL_CLASSES}>
              First name
            </label>
            <input
              id="contact-first-name"
              name="firstName"
              type="text"
              placeholder="Aoife"
              className={INPUT_CLASSES}
            />
          </div>
          <div>
            <label htmlFor="contact-last-name" className={LABEL_CLASSES}>
              Last name
            </label>
            <input
              id="contact-last-name"
              name="lastName"
              type="text"
              placeholder="Byrne"
              className={INPUT_CLASSES}
            />
          </div>
        </div>
        <div>
          <label htmlFor="contact-email" className={LABEL_CLASSES}>
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            placeholder="you@email.com"
            className={INPUT_CLASSES}
          />
        </div>
        <div>
          <label htmlFor="contact-topic" className={LABEL_CLASSES}>
            Topic
          </label>
          <select id="contact-topic" name="topic" className={INPUT_CLASSES}>
            {TOPICS.map((topic) => (
              <option key={topic}>{topic}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="contact-message" className={LABEL_CLASSES}>
            Message
          </label>
          <textarea
            id="contact-message"
            name="message"
            rows={4}
            placeholder="How can we help?"
            className={`${INPUT_CLASSES} resize-y`}
          />
        </div>
        <button
          type="submit"
          className="cursor-pointer rounded-pill border-none bg-forest p-[14px] font-sans text-[15px] font-semibold text-white"
        >
          {sent ? "Message sent ✓" : "Send message"}
        </button>
        <div aria-live="polite">
          {sent && (
            <div className="text-center text-[13px] text-forest">
              Thanks — this is a prototype, but in production your message
              would be on its way. ✓
            </div>
          )}
        </div>
        <p className="m-0 text-center text-[11.5px] leading-[1.5] text-caption">
          By sending you agree to our{" "}
          <Link href="/legal/privacy" className="text-forest no-underline">
            privacy policy
          </Link>
          . For medical emergencies contact your GP or 112.
        </p>
      </form>
    </div>
  );
}
