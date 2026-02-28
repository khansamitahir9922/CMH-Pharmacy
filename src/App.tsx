import React from 'react'
import { HashRouter } from 'react-router-dom'
import { AppBoot } from '@/components/AppBoot'

export default function App(): React.ReactElement {
  return (
    <HashRouter>
      <AppBoot />
    </HashRouter>
  )
}
