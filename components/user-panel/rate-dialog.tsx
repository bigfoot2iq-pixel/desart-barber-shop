"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useT } from "@/lib/i18n/client-dictionary";

interface RateDialogProps {
  onClose: () => void;
  onSubmit: (rating: number, comment: string | null) => void;
}

export function RateDialog({ onClose, onSubmit }: RateDialogProps) {
  const tUser = useT('userPanel');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      onSubmit(rating, comment.trim() || null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      className="absolute inset-0 bg-[rgb(10_8_0/40%)] [backdrop-filter:blur(3px)] z-[20] flex items-center justify-center p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="bg-[#fafaf8] rounded-2xl w-full max-w-[320px] p-6 shadow-[0_12px_40px_rgb(0_0_0/18%)]"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 250 }}
      >
        <h3 className="font-playfair text-[22px] font-medium text-brand-black mb-1 text-center">{tUser('rateDialog.title')}</h3>
        <p className="text-[12px] text-[rgb(10_8_0/45%)] text-center mb-5">{tUser('rateDialog.subtitle')}</p>

        <div className="flex justify-center gap-1.5 mb-5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-0.5 cursor-pointer bg-none border-none"
              aria-label={tUser('rateDialog.starAria', { count: star })}
            >
              <svg viewBox="0 0 24 24" width="36" height="36" className={`transition-colors duration-150 ${
                star <= (hoverRating || rating) ? "fill-gold text-gold" : "fill-none text-[rgb(10_8_0/15%)]"
              }`} stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={tUser('rateDialog.placeholder')}
          rows={3}
          className="w-full bg-white border-[1.5px] border-[rgb(10_8_0/14%)] rounded-xl px-4 py-3 text-sm text-brand-black outline-none transition-[border-color] duration-200 placeholder:text-[rgb(10_8_0/25%)] focus:border-gold resize-none [scrollbar-width:thin] [scrollbar-color:rgb(10_8_0/15%)_transparent]"
        />

        <div className="flex gap-2.5 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border-[1.5px] border-[rgb(10_8_0/14%)] rounded-xl py-3 text-sm font-semibold text-brand-black transition-[background,border-color] duration-200 hover:bg-[rgb(10_8_0/3%)]"
          >
            {tUser('rateDialog.skip')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="flex-1 bg-brand-black text-white rounded-xl py-3 text-sm font-semibold transition-[background,opacity] duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink"
          >
            {submitting ? tUser('rateDialog.submitting') : tUser('rateDialog.submit')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
