# AI Chat Analyzer — Global UI/UX Design System

## Design intent

AI Chat Analyzer uses a **creamy candy** visual language: warm paper backgrounds, restrained pastel accents, dark high-contrast typography, generous but consistent spacing, and friendly rounded surfaces. Visual decoration must never compete with the analysis itself.

## Information hierarchy

Every screen follows this order whenever the content supports it: **core data → trends → detailed analysis → advanced information**. Core data is visible by default. Trends answer a specific question with a chart or timeline. Detailed analysis is progressively disclosed through tabs, accordions, or “view details” actions. Advanced information is available without crowding the first view.

Objective statistics are labelled **Data**. Model-generated interpretation is labelled **AI Insight** and must use language such as “可能顯示”, “推測” or “可觀察到的訊號”, never presenting inference as fact.

## Tokens

| Category | Rule |
|---|---|
| Color | `--ink` for primary text, `--muted` for secondary text, `--paper` for surfaces, `--line` for borders, `--blue` for primary actions, `--mint` for success, `--coral` for warnings. Keep contrast readable. |
| Type | Use the existing system sans-serif stack. Headings are strong and compact; body text uses a comfortable 1.65 line-height. Never use low-contrast pastel text for essential information. |
| Spacing | 4px base unit. Preferred values: 4, 8, 12, 16, 24, 32, 48. Avoid one-off spacing values. |
| Radius | 20px for cards and major surfaces; 13px for fields and controls; pill radius only for compact status labels. |
| Shadow | Use one soft surface shadow and one elevated interactive shadow. Do not shadow every nested element. |
| Layout | Mobile first. Use Grid/Flexbox, `minmax(0, 1fr)`, `auto-fit`, `gap`, `max-width`, and intrinsic sizing. Do not use fixed-width content as the primary layout strategy. |
| Breakpoints | Base styles target phones; enhance at 460px, 700px, 860px, 1020px, and 1440px. Breakpoints change composition, not only scale. |

## Component contract

Buttons, links, fields, cards, notices, tabs, accordions, loading states, empty states, error states, and success states must use the existing shared class vocabulary. Every interactive element requires visible `:hover`, `:focus-visible`, `:active`, and `:disabled` states. Keyboard focus must remain visible against the creamy background.

## Responsive contract

On phones, content is single-column, actions are full-width when necessary, navigation and secondary controls may scroll or collapse, and long text wraps with `overflow-wrap:anywhere`. On tablets, related content may form two columns. On desktop, content may use multi-column grids but must keep `minmax(0, 1fr)` so data cannot push the viewport wider than the screen.

## State contract

Every primary workflow considers Loading, Empty, Error, and Success. Errors explain what happened and what to do next. Loading does not block unrelated navigation. Motion is short, purposeful, and disabled or reduced under `prefers-reduced-motion: reduce`.
