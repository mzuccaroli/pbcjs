import { Type, type Static } from '@sinclair/typebox'

const NUMBER = String.raw`-?\d+(?:\.\d+)?(?:%|deg)?`

export const ID_PATTERN = '^[a-z0-9][a-z0-9-]{0,62}$'
export const SEMVER_PATTERN = String.raw`^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$`
export const TOKEN_KEY_PATTERN = '^[a-z0-9][a-z0-9-]*$'
export const COLOR_PATTERN = String.raw`^(?:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(?:rgba?|hsla?)\(\s*${NUMBER}(?:\s*[,/\s]\s*${NUMBER}){2,3}\s*\))$`
export const FONT_PATTERN = `^[A-Za-z0-9 ,'"-]+$`
export const LENGTH_PATTERN = String.raw`^(?:0|\d+(?:\.\d+)?(?:px|rem|em|%))$`
export const IMAGE_PATTERN = String.raw`^assets/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*\.(?:png|jpg|jpeg|webp|gif|avif|svg)$`

function category(valuePattern: string) {
  return Type.Optional(
    Type.Record(
      Type.String({ pattern: TOKEN_KEY_PATTERN }),
      Type.String({ pattern: valuePattern }),
      {
        additionalProperties: false,
      },
    ),
  )
}

export const ThemeTokens = Type.Object(
  {
    color: category(COLOR_PATTERN),
    font: category(FONT_PATTERN),
    radius: category(LENGTH_PATTERN),
    space: category(LENGTH_PATTERN),
    image: category(IMAGE_PATTERN),
  },
  { additionalProperties: false },
)
export type ThemeTokens = Static<typeof ThemeTokens>

export const ThemeManifest = Type.Object(
  {
    id: Type.String({ pattern: ID_PATTERN }),
    name: Type.String({ minLength: 1, maxLength: 80 }),
    version: Type.String({ pattern: SEMVER_PATTERN }),
    tokens: ThemeTokens,
    /** Reserved for configurable layouts (phase 3); ignored for now. */
    layout: Type.Optional(Type.Unknown()),
    /** Reserved for component overrides (phase 3); ignored for now. */
    components: Type.Optional(Type.Unknown()),
  },
  { additionalProperties: false },
)
export type ThemeManifest = Static<typeof ThemeManifest>

export type TokenCategory = keyof ThemeTokens

export const TOKEN_CATEGORIES: readonly TokenCategory[] = [
  'color',
  'font',
  'radius',
  'space',
  'image',
]
