export const bottomNavItems = [
  { to: '/', end: true, icon: 'inbox', label: '届いた手紙' },
  { to: '/write', end: false, icon: 'write', label: '書く' },
  { to: '/traveling', end: false, icon: 'travel', label: '旅する手紙' },
] as const

export type BottomNavIconName = (typeof bottomNavItems)[number]['icon'] | 'lock'
