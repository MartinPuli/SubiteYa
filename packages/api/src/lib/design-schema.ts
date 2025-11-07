/**
 * @fileoverview Design Profile Schema
 * Purpose: Zod schema for video design patterns with versioning
 */

import { z } from 'zod';

export const DesignSpec = z.object({
  aspectRatio: z.enum(['9:16', '1:1', '16:9']).default('9:16'),

  safeAreas: z
    .object({
      top: z.number().default(180),
      bottom: z.number().default(220),
    })
    .optional(),

  typography: z.object({
    fontFamily: z.string().default('Inter'),
    colorPrimary: z.string().default('#ffffff'),
    stroke: z
      .object({
        width: z.number().default(2),
        color: z.string().default('#000000'),
      })
      .optional(),
  }),

  brand: z
    .object({
      watermark: z
        .object({
          url: z.string(),
          opacity: z.number().min(0).max(1).default(0.8),
          position: z.enum(['tl', 'tr', 'bl', 'br']).default('tr'),
        })
        .optional(),
      intro: z
        .object({
          url: z.string(),
          seconds: z.number().default(1),
        })
        .optional(),
      outro: z
        .object({
          url: z.string(),
          seconds: z.number().default(1),
        })
        .optional(),
    })
    .optional(),

  captions: z
    .object({
      enabled: z.boolean().default(true),
      style: z.enum(['karaoke', 'classic']).default('karaoke'),
      aiLanguage: z.enum(['auto', 'es', 'en']).default('auto'),
    })
    .optional(),

  layout: z
    .object({
      autoCrop: z.enum(['face', 'subject', 'none']).default('face'),
      padding: z.number().default(32),
      bg: z.enum(['blur', 'solid']).default('blur'),
    })
    .optional(),

  overlays: z
    .array(
      z.object({
        type: z.enum(['text', 'image', 'rect']),
        start: z.number().default(0),
        end: z.number().optional(),
        props: z.record(z.string(), z.any()),
      })
    )
    .default([]),

  uploadHints: z
    .object({
      titleTemplate: z.string().default(''),
      tags: z.array(z.string()).default([]),
    })
    .optional(),
});

export type DesignSpecType = z.infer<typeof DesignSpec>;

// Example design profile for TikTok
export const EXAMPLE_TIKTOK_DESIGN: DesignSpecType = {
  aspectRatio: '9:16',
  typography: {
    fontFamily: 'SF Pro',
    colorPrimary: '#ffffff',
    stroke: {
      width: 2,
      color: '#000',
    },
  },
  brand: {
    watermark: {
      url: 'https://storage.example.com/watermark.png',
      opacity: 0.8,
      position: 'tr',
    },
  },
  captions: {
    enabled: true,
    style: 'karaoke',
    aiLanguage: 'es',
  },
  layout: {
    autoCrop: 'face',
    padding: 48,
    bg: 'blur',
  },
  overlays: [
    {
      type: 'image',
      start: 0,
      end: 2,
      props: {
        url: 'https://storage.example.com/intro.png',
        x: 0.5,
        y: 0.2,
      },
    },
    {
      type: 'text',
      start: 1,
      end: 999,
      props: {
        text: '@miCuenta',
        anchor: 'br',
        margin: 24,
        size: 18,
      },
    },
  ],
  uploadHints: {
    titleTemplate: '{topic} | {cta}',
    tags: ['#subiteya', '#argentina'],
  },
};

// Deep merge function for combining design specs
export function mergeDesignSpecs(
  base: Partial<DesignSpecType>,
  override: Partial<DesignSpecType>
): DesignSpecType {
  const merged: Record<string, unknown> = { ...base };

  for (const key in override) {
    const value = override[key as keyof DesignSpecType];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      merged[key] = {
        ...(merged[key] as Record<string, unknown>),
        ...value,
      };
    } else {
      merged[key] = value;
    }
  }

  return DesignSpec.parse(merged);
}
