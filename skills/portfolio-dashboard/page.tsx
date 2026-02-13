import { Dashboard } from "//components/dashboard"
import { AIAdvisor } from "//components/ai-advisor"
import { MarketIntelligence } from "//components/market-intelligence"
import { InteractiveFeatures } from "//components/interactive-features"
import { SentimentTracker } from "//components/sentiment-tracker"
import { ApeWisdomTracker } from "//components/apewisdom-tracker"
import { EarningsCalendar } from "//components/earnings-calendar"

export const metadata = {
  title: "Kai's Portfolio Dashboard",
  description: "Live portfolio tracking with AI insights",
}

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Hero Section */}
        <header className="mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
            <span className="text-3xl">🦞</span> Money Lobster Dashboard
          </h1>
          <p className="text-zinc-500 text-lg">Your personal portfolio command center</p>
        </header>

        {/* Dashboard Overview */}
        <section className="animate-slide-up">
          <Dashboard />
        </section>

        {/* AI Advisor Section */}
        <section className="mt-12 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <AIAdvisor />
        </section>

        {/* Market Intelligence Section */}
        <section className="mt-12 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <MarketIntelligence />
        </section>

        {/* Interactive Features Section */}
        <section className="mt-12 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <InteractiveFeatures />
        </section>

        {/* Sentiment Tracker Section */}
        <section className="mt-12 animate-slide-up" style={{ animationDelay: '0.5s' }}>
          <SentimentTracker />
        </section>

        {/* ApeWisdom Tracker Section */}
        <section className="mt-12 animate-slide-up" style={{ animationDelay: '0.6s' }}>
          <ApeWisdomTracker />
        </section>

        {/* Earnings Calendar Section */}
        <section className="mt-12 animate-slide-up" style={{ animationDelay: '0.7s' }}>
          <EarningsCalendar />
        </section>
        
      </div>
    </main>
  )
}
