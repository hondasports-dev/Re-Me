import { createTheme, type CSSVariablesResolver, type MantineColorsTuple } from '@mantine/core'

const sky: MantineColorsTuple = [
  '#f0f7fd',
  '#deedf9',
  '#c5e0f4',
  '#9fc9e8',
  '#7fa9ce',
  '#668fb7',
  '#52779b',
  '#45617e',
  '#3c5268',
  '#354657',
]

const navy: MantineColorsTuple = [
  '#f4f7fb',
  '#e6edf4',
  '#c9d6e4',
  '#a7b9cc',
  '#8296ad',
  '#617189',
  '#4a5a70',
  '#3a4a5e',
  '#2c3c50',
  '#203047',
]

const peach: MantineColorsTuple = [
  '#fdf6f3',
  '#f8e6de',
  '#f0d0c2',
  '#e7b8a5',
  '#d9a08a',
  '#c48771',
  '#a86d5b',
  '#8c5749',
  '#70463b',
  '#5a382f',
]

export const reMeTheme = createTheme({
  primaryColor: 'sky',
  primaryShade: 4,
  autoContrast: true,
  white: '#ffffff',
  black: '#203047',
  fontFamily: 'var(--re-me-font-sans)',
  headings: {
    fontFamily: 'var(--re-me-font-serif)',
    fontWeight: '400',
  },
  colors: {
    sky,
    navy,
    peach,
  },
  defaultRadius: 'lg',
  radius: {
    xs: 'var(--re-me-radius-sm)',
    sm: 'var(--re-me-radius-sm)',
    md: 'var(--re-me-radius-md)',
    lg: 'var(--re-me-radius-lg)',
    xl: 'var(--re-me-radius-xl)',
  },
  spacing: {
    xs: 'var(--re-me-space-2)',
    sm: 'var(--re-me-space-3)',
    md: 'var(--re-me-space-4)',
    lg: 'var(--re-me-space-5)',
    xl: 'var(--re-me-space-6)',
  },
  shadows: {
    xs: 'var(--re-me-shadow-sm)',
    sm: 'var(--re-me-shadow-sm)',
    md: 'var(--re-me-shadow-md)',
    lg: 'var(--re-me-shadow-soft)',
    xl: 'var(--re-me-shadow-soft)',
  },
  cursorType: 'pointer',
  focusRing: 'auto',
  components: {
    Button: {
      defaultProps: {
        color: 'sky',
        radius: 'xl',
      },
    },
    Skeleton: {
      defaultProps: {
        radius: 'md',
      },
    },
    AppShell: {
      defaultProps: {
        withBorder: false,
        padding: 0,
      },
    },
  },
})

export const reMeCssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    '--mantine-color-body': 'var(--re-me-color-mist)',
    '--mantine-color-text': 'var(--re-me-color-ink)',
    '--mantine-color-anchor': 'var(--re-me-color-sky-deep)',
    '--mantine-color-error': 'var(--re-me-color-danger)',
    '--mantine-color-dimmed': 'var(--re-me-color-ink-muted)',
    '--mantine-font-family': 'var(--re-me-font-sans)',
    '--mantine-font-family-headings': 'var(--re-me-font-serif)',
  },
  light: {
    '--mantine-color-body': 'var(--re-me-color-mist)',
    '--mantine-color-text': 'var(--re-me-color-ink)',
    '--mantine-color-anchor': 'var(--re-me-color-sky-deep)',
    '--mantine-color-error': 'var(--re-me-color-danger)',
    '--mantine-color-dimmed': 'var(--re-me-color-ink-muted)',
  },
  dark: {
    '--mantine-color-body': 'var(--re-me-color-mist)',
    '--mantine-color-text': 'var(--re-me-color-ink)',
    '--mantine-color-anchor': 'var(--re-me-color-sky-deep)',
    '--mantine-color-error': 'var(--re-me-color-danger)',
    '--mantine-color-dimmed': 'var(--re-me-color-ink-muted)',
  },
})
