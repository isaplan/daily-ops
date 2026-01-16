/**
 * @registry-id: designPage
 * @created: 2026-01-16T12:00:00.000Z
 * @last-modified: 2026-01-16T14:35:00.000Z
 * @description: Design lab mock describing environments, components, and theming for Daily Ops
 * @last-fix: [2026-01-16] Updated preview nav text weight
 * 
 * @exports-to:
 *   ✓ app/layout.tsx => Surfaces /design route through sidebar
 */

'use client'

import './fonts.css'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { cn } from '@/lib/utils/cn'

const environmentThemes = [
  {
    id: 'collaboration',
    label: 'Collaboration',
    accent: 'from-indigo-500/80 via-blue-600 to-slate-900/70',
    short: 'ClickUp-like grid of cards, modules, and templates.',
    paletteId: 'bold',
  },
  {
    id: 'chats',
    label: 'Chats',
    accent: 'from-amber-500/80 via-orange-500 to-rose-900/70',
    short: 'Slack-style channels + linked notes/todos with badges.',
    paletteId: 'spark',
  },
  {
    id: 'daily-ops',
    label: 'Daily Ops',
    accent: 'from-cyan-500/80 via-teal-600 to-slate-900/80',
    short: 'Data-first dashboard with KPIs, revenue chips, and live sources.',
    paletteId: 'calm',
  },
]

const collaborationModules = [
  {
    title: 'Projects & Decisions',
    description:
      'Card grid with project context, decisions, and linked conversations—also surfaces champs, timelines, and dependencies.',
    tags: ['Notes', 'Decisions', 'Todos', 'Events'],
  },
  {
    title: 'Chats & Channels',
    description:
      'Inline mentions, pinned todos, and tasks appear next to channel threads; each note shows the originating channel.',
    tags: ['Channels', 'Aggregated Todos'],
  },
  {
    title: 'Daily Ops Metrics',
    description:
      'Owners-only view with hours, revenue, subscriptions, and PowerBI exports; attachments/ingest status badges keep upstream trust.',
    tags: ['Hours', 'Revenue', 'API', 'Email'],
  },
]

const locationLinks = [
  { label: 'All', detail: 'Unified view across org + partners' },
  { label: 'Locations', detail: 'By geography or team' },
  { label: 'Daily Ops', detail: 'Management + partners, revenue focus' },
  { label: 'Teams', detail: 'Members, squads, and squads hubs' },
]

const themePalettes = [
  {
    id: 'bold',
    label: 'Bold',
    accent: 'from-indigo-500/80 via-blue-600 to-slate-900/90',
    section: 'bg-gradient-to-br from-slate-900/80 via-slate-950/80 to-slate-950',
    panel: 'bg-slate-900/70',
    page: 'bg-gradient-to-br from-slate-950 to-slate-900/80',
    dot: 'from-indigo-500 to-blue-500',
    preview: 'bg-gradient-to-r from-slate-900/80 to-slate-950/70',
  },
  {
    id: 'spark',
    label: 'Spark',
    accent: 'from-amber-500/80 via-orange-500 to-rose-800/90',
    section: 'bg-gradient-to-br from-slate-900/80 via-rose-900/70 to-slate-950',
    panel: 'bg-slate-900/60',
    page: 'bg-gradient-to-br from-slate-950 via-slate-900/70 to-slate-900',
    dot: 'from-amber-500 to-rose-500',
    preview: 'bg-gradient-to-r from-slate-900/80 via-rose-900/50 to-slate-950/80',
  },
  {
    id: 'calm',
    label: 'Calm',
    accent: 'from-cyan-500/80 via-teal-600 to-slate-900/80',
    section: 'bg-gradient-to-br from-slate-900/80 via-slate-950/70 to-slate-950',
    panel: 'bg-slate-900/60',
    page: 'bg-gradient-to-br from-slate-950 via-slate-900/70 to-slate-950',
    dot: 'from-cyan-500 to-teal-500',
    preview: 'bg-gradient-to-r from-slate-900/80 via-cyan-900/30 to-slate-950/80',
  },
]

const workspaceSwitcher = [
  {
    label: 'All',
    fullName: 'All Operations',
    detail: 'Master workspace',
    status: 'ongoing',
    initials: 'AO',
  },
  {
    label: 'Locations',
    fullName: 'Location Hubs',
    detail: 'Plant / market',
    status: 'focused',
    initials: 'LH',
  },
  {
    label: 'Daily Ops',
    fullName: 'Daily Ops HQ',
    detail: 'Management + partners',
    status: 'secure',
    initials: 'DO',
  },
  {
    label: 'Global',
    fullName: 'Global Enterprise',
    detail: 'Enterprise view',
    status: 'muted',
    initials: 'GE',
  },
]

const previewPanels = {
  collaboration: {
    title: 'Collaboration',
    sidebar: ['Projects', 'Decisions', 'Notes', 'Events'],
    nav: ['Dashboard', 'Notes', 'Todos', 'Channels'],
  },
  chats: {
    title: 'Chats',
    sidebar: ['Channels', 'Threads', 'Linked notes', 'Todos'],
    nav: ['All', 'Mentions', 'Channels', 'Files'],
  },
  'daily-ops': {
    title: 'Daily Ops',
    sidebar: ['KPIs', 'Sources', 'Revenue', 'Hours'],
    nav: ['Daily Ops', 'Sources', 'Invoices', 'Reports'],
  },
}

const tokenCards = [
  {
    title: 'Typography',
    value: 'Space Grotesk',
    detail: '16 px base, 1.5 line height, 14 px support type for dense tables',
  },
  {
    title: 'Corner Radius',
    value: 'rounded-xl',
    detail: 'Switch between square, rounded, and pill with the theme toggles below.',
  },
  {
    title: 'Shadow & Depth',
    value: 'shadow-xl / soft',
    detail: 'Use gradients with glassmorphism for cards, keeping backgrounds minimal.',
  },
]

export default function DesignPage() {
  const [activeTheme, setActiveTheme] = useState(environmentThemes[0].id)
  const [roundedCorners, setRoundedCorners] = useState(true)
  const [elevatedShadows, setElevatedShadows] = useState(true)
  const [hoverGlow, setHoverGlow] = useState(false)
  const [fontChoice, setFontChoice] = useState<'default' | 'notion'>('default')
  const [previewEnv, setPreviewEnv] = useState(environmentThemes[0].id)
  const [paletteChoice, setPaletteChoice] = useState(environmentThemes[0].paletteId)

  const theme = useMemo(
    () => environmentThemes.find((entry) => entry.id === activeTheme) ?? environmentThemes[0],
    [activeTheme]
  )

  const palette =
    themePalettes.find((entry) => entry.id === paletteChoice) ?? themePalettes[0]

  const fontClass = fontChoice === 'notion' ? 'font-notion' : 'font-default'
  const pageClass = cn('min-h-screen px-6 py-10 text-white', fontClass, palette.page)

  return (
    <div className={pageClass}>
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-tight text-slate-400">Design Lab</p>
              <h1 className="text-3xl font-bold text-white">Daily Ops System</h1>
              <p className="text-base text-slate-300">
                Unified navigation, component library, and theming thoughts for Collaboration, Chats, and Daily Ops
                experiences.
              </p>
            </div>
            <Button variant="outline" size="sm">
              Explore system
            </Button>
          </div>
          <div
            className={cn(
              'rounded-3xl border border-white/10 p-6 shadow-2xl shadow-black/40',
              palette.section
            )}
          >
            <p className="text-sm uppercase text-slate-400">Environment switcher</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {environmentThemes.map((item) => {
                const isActive = item.id === activeTheme
                return (
                  <button
                    key={item.id}
                    className={cn(
                      'flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all',
                  isActive
                    ? `bg-gradient-to-r ${palette.accent} text-white shadow-lg shadow-black/60`
                    : 'bg-white/5 text-white/70 hover:bg-white/20 hover:text-white'
                    )}
                onClick={() => {
                  setActiveTheme(item.id)
                  setPreviewEnv(item.id)
                  const themePalette = environmentThemes.find((entry) => entry.id === item.id)
                  if (themePalette?.paletteId) {
                    setPaletteChoice(themePalette.paletteId)
                  }
                }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                    {item.label}
                  </button>
                )
              })}
            </div>
              <div className="mt-5 rounded-2xl bg-slate-900/60 px-5 py-4 text-sm text-slate-200 shadow-inner shadow-black/20 backdrop-blur">
              <p className="font-semibold text-white">{theme.short}</p>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{theme.label} palette</p>
              <div className="mt-3 h-2 w-full rounded-full bg-gradient-to-r from-white/10 to-white/5" />
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {collaborationModules.map((module) => (
            <Card
              key={module.title}
              className={cn(
                'flex flex-col justify-between gap-4 border-white/5 bg-gradient-to-br shadow-lg shadow-black/50',
                roundedCorners ? 'rounded-2xl' : 'rounded-none',
                elevatedShadows ? 'shadow-xl' : 'shadow-none'
              )}
            >
              <CardHeader>
                <CardTitle>{module.title}</CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {module.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <Badge variant="outline">{theme.label}</Badge>
                <span className="text-xs uppercase tracking-widest text-slate-400">Blueprint</span>
              </CardFooter>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <div className={cn('space-y-4 rounded-3xl border border-white/10 p-4', palette.panel)}>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Locations (Slack-style)</p>
            <div className="space-y-3">
              {locationLinks.map((link) => (
                <div
                  key={link.label}
                  className="flex flex-col rounded-xl border border-white/5 p-3 text-sm text-slate-200"
                >
                  <span className="font-semibold text-white">{link.label}</span>
                  <span className="text-xs text-slate-400">{link.detail}</span>
                </div>
              ))}
            </div>
          </div>
          <div
            className={cn(
              'space-y-4 rounded-3xl border border-white/5 p-6 shadow-2xl shadow-black/40',
              palette.panel
            )}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Design system & theming</h2>
              <Badge variant="default">shadcn + tailwind</Badge>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-tight text-slate-400">
              <span>Font:</span>
              <Button
                variant={fontChoice === 'notion' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFontChoice('notion')}
              >
                Notion (Inter)
              </Button>
              <Button
                variant={fontChoice === 'default' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFontChoice('default')}
              >
                Default
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-tight text-slate-400">
              <span>Palette:</span>
              {themePalettes.map((paletteOption) => (
                <Button
                  key={paletteOption.id}
                  variant={paletteChoice === paletteOption.id ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setPaletteChoice(paletteOption.id)}
                >
                  <span
                    className={cn(
                      'mr-2 inline-block h-1.5 w-6 rounded-full bg-gradient-to-r',
                      paletteOption.dot
                    )}
                  />
                  {paletteOption.label}
                </Button>
              ))}
            </div>
            <Tabs defaultValue="palette">
              <TabsList className="space-x-2 bg-slate-800/60">
                <TabsTrigger value="palette">Palettes</TabsTrigger>
                <TabsTrigger value="components">Components</TabsTrigger>
                <TabsTrigger value="mood">Mood</TabsTrigger>
              </TabsList>
              <TabsContent value="palette">
                <div className="grid gap-3 md:grid-cols-3">
                  {tokenCards.map((token) => (
                    <div
                      key={token.title}
                      className="rounded-2xl border border-white/5 bg-white/5 p-4 text-sm text-slate-200"
                    >
                      <p className="text-xs uppercase tracking-tight text-slate-500">{token.title}</p>
                      <p className="text-lg font-semibold text-white">{token.value}</p>
                      <p className="text-xs text-slate-400">{token.detail}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="components">
                <div className="grid gap-3 md:grid-cols-2">
                  <Card className="rounded-xl border border-white/10 bg-slate-900/50">
                    <CardHeader className="px-4 pb-2 pt-4">
                      <CardTitle>Component tokens</CardTitle>
                      <CardDescription>Buttons, badges, cards all follow the same spacing scale.</CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pt-0">
                      <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Kit</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {['Button', 'Card', 'Tabs', 'Switch'].map((label) => (
                          <Badge key={label} variant="outline">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl border border-white/10 bg-slate-900/50">
                    <CardHeader className="px-4 pb-2 pt-4">
                      <CardTitle>Hover actions</CardTitle>
                      <CardDescription>Hover/active states honor the same glow depth.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex gap-4 px-4 pt-0">
                      <Badge variant="secondary">hover</Badge>
                      <Badge variant="default">active</Badge>
                      <Badge variant="outline">focus</Badge>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              <TabsContent value="mood">
                <p className="text-sm text-slate-300">
                  Mondrian-informed color splashes set the tone while the layout remains clean; card outlines are
                  softened depending on the rounded/shadow toggles below. Add deliberate pops of Picasso/ClickUp energy
                  via accent gradients on section headers.
                </p>
              </TabsContent>
            </Tabs>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="border border-white/5 bg-gradient-to-br from-slate-900/50 to-slate-950/90">
            <CardHeader>
              <CardTitle>Nav + Components</CardTitle>
              <CardDescription>Nav, section chips, and cards share a single design system token set.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="flex space-x-3 overflow-hidden rounded-full bg-white/5 p-2">
                {environmentThemes.map((item) => {
                  const isActive = item.id === activeTheme
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'flex-1 rounded-full px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] transition-all',
                        isActive ? `bg-gradient-to-r ${item.accent} text-white` : 'text-slate-400'
                      )}
                    >
                      {item.label}
                    </div>
                  )
                })}
              </div>
              <div className="space-y-3">
                {['design', 'components', 'theming'].map((label) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3"
                  >
                    <span className="text-sm font-medium uppercase tracking-tight text-slate-400">{label}</span>
                    <span className="text-xs font-semibold text-white">Live</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/5 bg-slate-900/60">
            <CardHeader>
              <CardTitle>Theming toggles</CardTitle>
              <CardDescription>Quickly flip corners, depth, and motion.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Rounded corners</span>
                <Switch checked={roundedCorners} onCheckedChange={(value) => setRoundedCorners(value)} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Elevated shadows</span>
                <Switch checked={elevatedShadows} onCheckedChange={(value) => setElevatedShadows(value)} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Hover glow</span>
                <Switch checked={hoverGlow} onCheckedChange={(value) => setHoverGlow(value)} />
              </div>
            </CardContent>
            <CardFooter className="pt-0">
              <Button variant="ghost" size="sm">
                Generate Tailwind tokens
              </Button>
            </CardFooter>
          </Card>
        </section>

        <section className={cn('space-y-4 rounded-[32px] border border-white/10 p-6', palette.section)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-tight text-slate-500">Preview</p>
              <h3 className="text-lg font-semibold">Nav + sidebar moods</h3>
            </div>
            <div className="flex gap-2 text-xs uppercase tracking-tight">
              {environmentThemes.map((env) => (
                <Button
                  key={env.id}
                  variant={previewEnv === env.id ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setPreviewEnv(env.id)}
                >
                  {env.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[120px_220px_1fr]">
            <div
            className={cn(
              'space-y-3 rounded-2xl border border-white/10 p-3 text-xs uppercase tracking-tight text-slate-400',
              palette.panel
            )}
            >
              <p className="text-[10px] tracking-[0.5em] text-slate-500">Workspaces</p>
              <div className="flex flex-wrap gap-2">
                {workspaceSwitcher.map((item) => (
                  <div
                    key={`${item.label}-icon`}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full text-[11px] font-bold uppercase text-white shadow-lg shadow-black/50',
                      `bg-gradient-to-br ${palette.dot}`
                    )}
                  >
                    {item.initials}
                  </div>
                ))}
              </div>
              <p className="text-[10px] uppercase tracking-[0.5em] text-slate-500">
                Compact icons // hover expands to full name state
              </p>
              <div className="space-y-2 text-[11px] text-slate-300">
                {workspaceSwitcher.map((item) => (
                  <div
                    key={`${item.label}-full`}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2 text-sm text-white"
                  >
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold uppercase text-white',
                        `bg-gradient-to-br ${palette.dot}`
                      )}
                    >
                      {item.initials}
                    </div>
                    <div>
                      <p className="font-semibold">{item.fullName}</p>
                      <p className="text-[10px] text-slate-400">
                        {item.status} • {item.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Sidebar</p>
              {previewPanels[previewEnv].sidebar.map((item) => (
                <div key={item} className="rounded-xl bg-black/20 px-3 py-2">
                  {item}
                </div>
              ))}
            </div>
            <div className={cn('rounded-2xl border border-white/10 p-4', palette.preview)}>
              <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-2 text-xs uppercase tracking-tight text-slate-400">
                <span>{previewPanels[previewEnv].title}</span>
                <span className="text-white/70">Top nav</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold text-slate-200">
                {previewPanels[previewEnv].nav.map((item) => (
                  <div key={item} className="rounded-full bg-white/5 px-4 py-2">
                    {item}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-400">
                Each nav variant can surface different sections, environment switchers, and quick actions for the selected context.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
