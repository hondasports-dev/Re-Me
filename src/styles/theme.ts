import { createTheme, type MantineThemeOverride } from '@mantine/core'

export const reMeTheme: MantineThemeOverride = createTheme({
  primaryColor: 'sky',
  fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', system-ui, sans-serif",
  headings: {
    fontFamily: "Georgia, 'Yu Mincho', 'Hiragino Mincho ProN', serif",
    fontWeight: '400',
  },
  colors: {
    sky: [
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
    ],
  },
  defaultRadius: 'lg',
  components: {
    Button: {
      defaultProps: {
        radius: 'xl',
      },
    },
  },
})
