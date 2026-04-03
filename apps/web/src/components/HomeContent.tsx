"use client";

import { lazy, Suspense } from "react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";

const UniversityCarousel = lazy(() => import("@/components/UniversityCarousel"));
const WhatIsEEISection = lazy(() => import("@/components/WhatIsEEISection"));
const SAFEMethodSection = lazy(() => import("@/components/SAFEMethodSection"));
const TestimonialsCarousel = lazy(() => import("@/components/TestimonialsCarousel"));
const WhyHighSchoolSection = lazy(() => import("@/components/WhyHighSchoolSection"));
const HowWeWorkSection = lazy(() => import("@/components/HowWeWorkSection"));
const FounderSection = lazy(() => import("@/components/FounderSection"));
const InstitutionalRecognitionSection = lazy(() => import("@/components/InstitutionalRecognitionSection"));
const ParentTestimonialsSection = lazy(() => import("@/components/ParentTestimonialsSection"));
const FinalCTA = lazy(() => import("@/components/FinalCTA"));
const Footer = lazy(() => import("@/components/Footer"));

export default function HomeContent() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-16">
        <HeroSection />

        <Suspense fallback={null}>
          <UniversityCarousel />
          <WhatIsEEISection />
          <SAFEMethodSection />
          <TestimonialsCarousel />
          <WhyHighSchoolSection />
          <HowWeWorkSection />
          <FounderSection />
          <InstitutionalRecognitionSection />
          <ParentTestimonialsSection />
          <FinalCTA />
          <Footer />
        </Suspense>
      </main>
    </div>
  );
}
