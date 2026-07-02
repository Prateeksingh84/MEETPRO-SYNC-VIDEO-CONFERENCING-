"use client";

import Link from "next/link";
import { useState } from "react";

const products = [
  {
    title: "Meetings",
    label: "HD video collaboration",
    icon: "🎥",
    href: "/dashboard",
    className: "meetings",
    description: "Secure meeting rooms with host controls, recording, chat, reactions, and screen sharing.",
  },
  {
    title: "My Notes",
    label: "AI note taker",
    icon: "✦",
    href: "/enterprise",
    className: "notes",
    description: "Capture summaries, action items, decisions, and follow-ups from every meeting.",
  },
  {
    title: "MeetSyncMate",
    label: "AI teammate",
    icon: "✨",
    href: "/enterprise",
    className: "mate",
    description: "Ask questions, generate documents, plan work, and turn conversations into execution.",
  },
  {
    title: "AI Productivity Suite",
    label: "Docs, slides, sheets",
    icon: "▦",
    href: "/products",
    className: "suite",
    description: "Create reports, proposals, notes, tasks, and workspace-ready deliverables.",
  },
  {
    title: "Phone",
    label: "Business calling",
    icon: "☎",
    href: "/support",
    className: "phone",
    description: "A roadmap-ready voice layer for sales, support, and customer communication workflows.",
  },
  {
    title: "Webinars",
    label: "Events and learning",
    icon: "▣",
    href: "/products",
    className: "webinars",
    description: "Run product demos, classes, founder sessions, workshops, and community events.",
  },
  {
    title: "Whiteboards",
    label: "Visual collaboration",
    icon: "□",
    href: "/whiteboards",
    className: "whiteboard",
    description: "Collaborate visually with real-time drawing and shared planning spaces.",
  },
  {
    title: "Team Chat",
    label: "Workspace messaging",
    icon: "💬",
    href: "/team-chat",
    className: "chat",
    description: "Coordinate with teammates using live presence, huddles, and real-time messaging.",
  },
];

const platformTabs = [
  {
    name: "Collaboration",
    imageClass: "collaboration",
    href: "/products",
    visual: "workspace",
    visualTitle: "Hybrid collaboration workspace",
    visualSubtitle: "Meetings, chat, whiteboards, recording, and notes in one flow.",
    chips: ["Meetings", "Team Chat", "Whiteboard", "Recording"],
    points: [
      "Support hybrid and remote work with reliable video, chat, whiteboards, and recordings.",
      "Bring meetings, chat, screen sharing, AI notes, and workspace tools into one flow.",
      "Keep workflows moving from discussion to documents, decisions, and follow-up actions.",
      "Use AI-ready summaries and action extraction to reduce manual work after calls.",
    ],
  },
  {
    name: "Customer support",
    imageClass: "support",
    href: "/support",
    visual: "support",
    visualTitle: "Support command center",
    visualSubtitle: "Resolve customer questions with live routing, meeting help, and guided actions.",
    chips: ["Open ticket", "Join help room", "Share guide", "Escalate"],
    points: [
      "Guide users through meeting join, camera permission, recording, and workspace issues.",
      "Use virtual agent workflows for instant answers and product navigation.",
      "Route complex issues to live meeting huddles with shared context.",
      "Prepare future CRM/helpdesk integrations for complete customer support visibility.",
    ],
  },
  {
    name: "Marketing",
    imageClass: "marketing",
    href: "/products",
    visual: "marketing",
    visualTitle: "Webinar and campaign studio",
    visualSubtitle: "Run launches, workshops, demos, and product sessions with reusable recordings.",
    chips: ["Webinar", "Campaign", "Lead notes", "Replay"],
    points: [
      "Host product demos, AI workshops, launch events, and community sessions.",
      "Record sessions and turn them into reusable content assets.",
      "Track engagement using meeting activity, chat, and attendance insights.",
      "Create post-event follow-ups, summaries, and campaign content with AI-ready workflows.",
    ],
  },
  {
    name: "Sales",
    imageClass: "sales",
    href: "/enterprise",
    visual: "sales",
    visualTitle: "Deal room and follow-up workspace",
    visualSubtitle: "Run demos, capture decisions, and move every conversation toward next steps.",
    chips: ["Discovery", "Demo", "Proposal", "Follow-up"],
    points: [
      "Run customer demos, discovery calls, partner meetings, and stakeholder reviews.",
      "Capture action items, objections, decisions, and next steps from every meeting.",
      "Use recordings and summaries to improve sales handoff and pipeline execution.",
      "Prepare AI-assisted follow-up drafts, notes, and deal briefs.",
    ],
  },
  {
    name: "Employee engagement",
    imageClass: "engagement",
    href: "/team-chat",
    visual: "engagement",
    visualTitle: "Team engagement hub",
    visualSubtitle: "Connect distributed teams with live huddles, updates, recognition, and async context.",
    chips: ["All hands", "Recognition", "Huddles", "Updates"],
    points: [
      "Keep teams connected with chat, huddles, whiteboards, and live meetings.",
      "Support async collaboration with recordings, notes, and shared workspace memory.",
      "Create operating rhythm through recurring meetings, action items, and collaboration spaces.",
      "Build trust with clear privacy controls and transparent data preferences.",
    ],
  },
];

const stories = [
  {
    tag: "Video SDK",
    title: "Advancing collaboration through a custom realtime meeting platform",
    quote:
      "MeetSync Pro brings video meetings, chat, recording, whiteboard, and AI-ready workflows into a single professional collaboration experience.",
    metric: "Realtime video",
    href: "/enterprise",
    className: "video",
  },
  {
    tag: "Analytics",
    title: "Turning meeting activity into operational insight",
    quote:
      "Live participant states, recording activity, chat flow, and workspace events create the foundation for dashboards and decision-ready analytics.",
    metric: "Live insights",
    href: "/dashboard",
    className: "analytics",
  },
  {
    tag: "Remote",
    title: "A connected workspace for distributed teams",
    quote:
      "Remote teams can join meetings, collaborate on whiteboards, message in team chat, and access AI-ready productivity workflows from one browser platform.",
    metric: "Hybrid work",
    href: "/team-chat",
    className: "remote",
  },
  {
    tag: "AI Notes",
    title: "From conversation to execution",
    quote:
      "Meeting content can be converted into summaries, action items, documentation, and follow-up tasks with consent-based AI workflows.",
    metric: "AI productivity",
    href: "/enterprise",
    className: "ai",
  },
];

const newsCards = [
  {
    title: "Meet My Notes: your new AI note taker",
    description: "Capture insights from conversations, meetings, and workspace discussions.",
    href: "/enterprise",
    className: "large notes",
  },
  {
    title: "MeetSync Pro launches professional meeting UI",
    description: "A cleaner call room with bottom controls, participant drawer, chat, recording, and host tools.",
    href: "/dashboard",
    className: "large meeting",
  },
  {
    title: "AI tools for business teams",
    description: "Summaries, action items, assistant workflows, and productivity automation.",
    href: "/enterprise",
    className: "small ai",
  },
  {
    title: "Privacy-first collaboration",
    description: "Cookie controls, secure headers, CORS, secrets, and consent-ready AI workflows.",
    href: "/security",
    className: "small security",
  },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState(0);
  const [activeStory, setActiveStory] = useState(0);

  const tab = platformTabs[activeTab];
  const story = stories[activeStory];

  return (
    <main className="ms-home">
      <header className="ms-nav">
        <Link href="/" className="ms-logo" aria-label="MeetSync Pro home">
          meetsync
        </Link>

        <nav className="ms-primary-nav" aria-label="Main navigation">
          <Link href="/products">Products⌄</Link>
          <Link href="/enterprise">✦ AI⌄</Link>
          <Link href="/enterprise">Solutions⌄</Link>
          <Link href="/pricing">Pricing</Link>
        </nav>

        <nav className="ms-utility-nav" aria-label="Utility navigation">
          <Link href="/products" aria-label="Search">⌕</Link>
          <Link href="/join">Meet⌄</Link>
          <Link href="/support">Support</Link>
          <Link href="/enterprise" className="ms-contact-btn">Contact Sales</Link>
          <Link href="/whats-new" className="ms-new-btn">What&apos;s New</Link>
          <Link href="/profile" className="ms-avatar">MS</Link>
          <Link href="/products" className="ms-waffle" aria-label="Apps">⋮⋮</Link>
        </nav>
      </header>

      <section className="ms-hero">
        <Link href="/enterprise" className="ms-alert-banner">
          <span>Introducing MeetSyncMate, your AI teammate.</span>
          <strong>Explore MeetSyncMate</strong>
          <b>×</b>
        </Link>

        <div className="ms-hero-copy">
          <h1>Find out what&apos;s possible when work connects</h1>
          <p>Bridge the gap between talking and doing with the AI-first work platform built for you.</p>

          <div className="ms-hero-actions">
            <Link href="/products">Explore products</Link>
            <Link href="/pricing">Find your plan</Link>
          </div>
        </div>

        <div className="ms-product-slider" aria-label="Product carousel">
          {products.map((product) => (
            <Link href={product.href} className={`ms-product-card ${product.className}`} key={product.title}>
              <div>
                <span>{product.icon}</span>
                <h2>{product.title}</h2>
              </div>
              <p>{product.description}</p>
              <small>{product.label}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="ms-notes">
        <div className="ms-dots">
          <span />
          <span />
          <span />
          <span />
          <span className="active" />
          <span />
          <span />
          <span />
        </div>

        <div className="ms-section-heading split">
          <div>
            <span className="ms-icon-badge">✦</span>
            <h2><em>My Notes</em>Your new AI note taker</h2>
          </div>
          <Link href="/enterprise">Explore My Notes</Link>
        </div>

        <div className="ms-notes-frame">
          <div className="ms-notes-window">
            <div className="ms-window-top">
              <i />
              <i />
              <i />
              <span>Q3 Product Kickoff</span>
            </div>

            <div className="ms-window-body">
              <div className="ms-video-tile speaker">
                <strong>P</strong>
                <small>Presenter</small>
              </div>

              <div className="ms-video-tile">
                <strong>T</strong>
                <small>Team</small>
              </div>

              <aside className="ms-ai-note-panel">
                <h3>My Notes</h3>
                <p>Take notes or use meeting transcript to create a personal summary.</p>
                <label><span /> Use meeting transcript</label>
                <label><span /> Auto-start note taking</label>
                <label><span /> Extract action items</label>
                <button>Start taking notes</button>
              </aside>
            </div>
          </div>
        </div>
      </section>

      <section className="ms-report-grid">
        <Link href="/enterprise" className="ms-report-card leader">
          <h3>AI-first collaboration platform for meetings, chat, notes, and recordings</h3>
          <span>Read the report</span>
        </Link>

        <Link href="/security" className="ms-report-card cx">
          <h3>MeetSync recognized for secure realtime collaboration architecture</h3>
          <span>Explore the report</span>
        </Link>

        <Link href="/enterprise" className="ms-report-card radar">
          <div className="radar-visual"><b>MS</b></div>
          <h3>Production roadmap for scalable video, Redis, SFU, and privacy governance</h3>
          <span>Read the report</span>
        </Link>
      </section>

      <section className="ms-platform" id="platform">
        <div className="ms-section-heading center">
          <h2>One platform.<br />Endless ways to work together.</h2>
        </div>

        <div className="ms-tabs" role="tablist" aria-label="MeetSync Pro use cases">
          {platformTabs.map((item, index) => (
            <button
              type="button"
              key={item.name}
              className={index === activeTab ? "active" : ""}
              onClick={() => setActiveTab(index)}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div className="ms-platform-panel">
          <div className="ms-platform-copy">
            <ul>
              {tab.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <Link href={tab.href}>Explore products</Link>
          </div>

          <div className={`ms-platform-visual ${tab.imageClass}`}>
            <div className={`ms-usecase-card ${tab.visual}`}>
              <div className="usecase-topbar">
                <span />
                <span />
                <span />
                <strong>{tab.name}</strong>
              </div>

              <div className="usecase-body">
                <div className="usecase-icon">{tab.visual === "workspace" ? "▦" : tab.visual === "support" ? "🎧" : tab.visual === "marketing" ? "📣" : tab.visual === "sales" ? "💼" : "🤝"}</div>
                <h3>{tab.visualTitle}</h3>
                <p>{tab.visualSubtitle}</p>

                <div className="usecase-chip-grid">
                  {tab.chips.map((chip) => (
                    <b key={chip}>{chip}</b>
                  ))}
                </div>

                <div className="usecase-preview">
                  {tab.visual === "workspace" && (
                    <>
                      <div className="mini-meeting">
                        <i>HD</i>
                        <strong>Live Meeting</strong>
                        <small>3 participants · recording ready</small>
                      </div>
                      <div className="mini-chat">
                        <b>Team Chat</b>
                        <span>Action item shared with workspace</span>
                      </div>
                    </>
                  )}

                  {tab.visual === "support" && (
                    <>
                      <div className="support-ticket">
                        <strong>Ticket #MS-204</strong>
                        <span>Camera permission issue detected</span>
                        <em>Suggested fix sent</em>
                      </div>
                      <div className="support-actions">
                        <button>Open help room</button>
                        <button>Send guide</button>
                      </div>
                    </>
                  )}

                  {tab.visual === "marketing" && (
                    <>
                      <div className="webinar-stage">
                        <strong>Product Launch Webinar</strong>
                        <span>Live Q&A · replay enabled · lead notes</span>
                      </div>
                      <div className="campaign-bars">
                        <i />
                        <i />
                        <i />
                      </div>
                    </>
                  )}

                  {tab.visual === "sales" && (
                    <>
                      <div className="deal-card">
                        <strong>Enterprise Demo</strong>
                        <span>Decision maker joined · proposal due Friday</span>
                      </div>
                      <div className="pipeline-row">
                        <b>Discovery</b>
                        <b>Demo</b>
                        <b>Close</b>
                      </div>
                    </>
                  )}

                  {tab.visual === "engagement" && (
                    <>
                      <div className="engagement-feed">
                        <strong>Weekly all-hands</strong>
                        <span>5 updates · 2 recognitions · 1 huddle</span>
                      </div>
                      <div className="people-row">
                        <i>P</i>
                        <i>A</i>
                        <i>S</i>
                        <i>+</i>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ms-trust">
        <h2>Trusted by builders. Built for you.</h2>

        <div className="ms-logo-marquee">
          <div>
            {["AILYTICS", "SRM", "Hestabit", "NITI Aayog", "Developers", "Startups", "Remote Teams", "Enterprises", "AI Builders", "Product Teams"].concat(["AILYTICS", "SRM", "Hestabit", "NITI Aayog", "Developers", "Startups", "Remote Teams", "Enterprises", "AI Builders", "Product Teams"]).map((logo, index) => (
              <span key={`${logo}-${index}`}>{logo}</span>
            ))}
          </div>
        </div>

        <div className="ms-ratings">
          <article>
            <strong>4.8/5</strong>
            <p>★ ★ ★ ★ <span>★</span></p>
            <small>Realtime meetings</small>
          </article>
          <article>
            <strong>99.9%</strong>
            <p>★ ★ ★ ★ <span>★</span></p>
            <small>Reliability roadmap</small>
          </article>
          <article>
            <strong>24/7</strong>
            <p>★ ★ ★ ★ <span>★</span></p>
            <small>Workspace ready</small>
          </article>
        </div>
      </section>

      <section className="ms-stories" id="customer-stories">
        <div className="ms-section-heading center">
          <p>Customer stories</p>
          <h2>Businesses achieve more with MeetSync Pro</h2>
        </div>

        <div className="ms-story-shell">
          <div className="ms-story-side">
            {stories.map((item, index) => (
              <button
                key={item.tag}
                type="button"
                className={index === activeStory ? "active" : ""}
                onClick={() => setActiveStory(index)}
              >
                {item.tag}
              </button>
            ))}
          </div>

          <article className={`ms-story-main ${story.className}`}>
            <div>
              <small>{story.metric}</small>
              <h3>{story.title}</h3>
              <blockquote>“{story.quote}”</blockquote>
              <p>— MeetSync Pro product story</p>
            </div>
            <Link href={story.href}>↗</Link>
          </article>

          <div className="ms-story-side right">
            {stories.map((item, index) => (
              <button
                key={`${item.tag}-right`}
                type="button"
                className={index === activeStory ? "active" : ""}
                onClick={() => setActiveStory(index)}
              >
                {item.metric}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="ms-news">
        <div className="ms-section-heading center">
          <p>What&apos;s new</p>
          <h2>Making news, making impact</h2>
        </div>

        <div className="ms-news-grid">
          {newsCards.map((card) => (
            <Link href={card.href} className={`ms-news-card ${card.className}`} key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <span>↗</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="ms-cta">
        <h2>See what MeetSync Pro can do for your business</h2>
        <div>
          <Link href="/auth">Get started today</Link>
          <Link href="/pricing">Find your plan</Link>
        </div>
        <p>
          MeetSyncMate AI features should be enabled with clear user consent and privacy-first meeting policies.
        </p>
      </section>

      <footer className="ms-footer">
        <div className="ms-footer-brand">
          <Link href="/">meetsync</Link>

          <div className="download-box">
            <span>⇩</span>
            <div>
              <strong>Download Center</strong>
              <small>Get the most out of MeetSync Pro</small>
            </div>
          </div>

          <button>English⌄</button>
          <button>Indian Rupee ₹⌄</button>

          <div className="touch">
            <small>Get in touch</small>
            <strong>+91 78277 27574</strong>
          </div>

          <div className="socials">
            <span>in</span>
            <span>𝕏</span>
            <span>▶</span>
            <span>f</span>
            <span>◎</span>
          </div>
        </div>

        <div className="ms-footer-cols">
          <div>
            <h4>About</h4>
            <Link href="/enterprise">MeetSync Blog</Link>
            <Link href="/enterprise">Customers</Link>
            <Link href="/enterprise">Our Team</Link>
            <Link href="/enterprise">Careers</Link>
            <Link href="/products">Integrations</Link>
            <Link href="/enterprise">Developers</Link>
          </div>

          <div>
            <h4>Download</h4>
            <Link href="/auth">MeetSync Workplace App</Link>
            <Link href="/dashboard">MeetSync Rooms App</Link>
            <Link href="/whiteboards">Whiteboard App</Link>
            <Link href="/team-chat">Team Chat App</Link>
            <Link href="/settings">Virtual Backgrounds</Link>
          </div>

          <div>
            <h4>Sales</h4>
            <Link href="/enterprise">Contact Sales</Link>
            <Link href="/pricing">Plans & Pricing</Link>
            <Link href="/enterprise">Request a Demo</Link>
            <Link href="/products">Webinars and Events</Link>
            <Link href="/enterprise">Experience Center</Link>
          </div>

          <div>
            <h4>Support</h4>
            <Link href="/join">Test Meeting</Link>
            <Link href="/profile">Account</Link>
            <Link href="/support">Support Center</Link>
            <Link href="/security">Security</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/support">Contact Us</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
