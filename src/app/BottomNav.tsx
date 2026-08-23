import { NavLink } from 'react-router'

import { bottomNavItems, type BottomNavIconName } from './bottom-nav'

export function BottomNav() {
  return (
    <nav aria-label="メインナビゲーション" className="bottom-nav">
      {bottomNavItems.map((item) => (
        <NavLink className="bottom-nav__link" end={item.end} key={item.to} to={item.to}>
          <NavIcon name={item.icon} />
          <span className="bottom-nav__label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function NavIcon({ name }: { name: BottomNavIconName }) {
  if (name === 'inbox') {
    return (
      <svg aria-hidden="true" className="bottom-nav__icon" fill="none" viewBox="0 0 24 24">
        <path
          d="M4.5 7.5h15v10.25a1.75 1.75 0 0 1-1.75 1.75h-11.5A1.75 1.75 0 0 1 4.5 17.75V7.5Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
        <path
          d="M4.5 7.5 12 3.75 19.5 7.5"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
        <path d="M8 13h8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      </svg>
    )
  }

  if (name === 'write') {
    return (
      <svg aria-hidden="true" className="bottom-nav__icon" fill="none" viewBox="0 0 24 24">
        <path
          d="M5.5 19.5H9l9.2-9.2a1.7 1.7 0 0 0 0-2.4l-1.6-1.6a1.7 1.7 0 0 0-2.4 0L5.5 15.9V19.5Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
        <path d="m13.2 7.3 3.5 3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" className="bottom-nav__icon" fill="none" viewBox="0 0 24 24">
      <path
        d="M4.5 12.5 19 5.75 14.2 19.5 11.4 13.4 4.5 12.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  )
}
