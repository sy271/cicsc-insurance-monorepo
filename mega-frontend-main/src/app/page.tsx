import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Shield, Sparkles, Clock, FileCheck } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 opacity-90"></div>
        <div className="relative container mx-auto px-4 py-24 text-white">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-bold mb-6">Simplify Your Insurance Management</h1>
            <p className="text-xl mb-8">Stop juggling multiple insurance policies. Get a clear view of your coverage and optimize your protection with our AI-powered platform.</p>
            <div className="flex gap-4">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/auth/sign-up">Get Started</Link>
              </Button>
              <Button size="lg" variant="outline" className="text-white border-white hover:bg-white/20">Learn More</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Why Choose Our Platform?</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="p-3 bg-blue-100 rounded-full mb-4">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold mb-2">Policy Aggregation</h3>
                <p className="text-gray-600">All your insurance policies in one secure place. No more scattered documents.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="p-3 bg-purple-100 rounded-full mb-4">
                  <Sparkles className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-semibold mb-2">AI Analysis</h3>
                <p className="text-gray-600">Smart detection of coverage gaps and optimization opportunities.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="p-3 bg-green-100 rounded-full mb-4">
                  <Clock className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-semibold mb-2">Smart Reminders</h3>
                <p className="text-gray-600">Never miss a premium payment or policy renewal date again.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="p-3 bg-orange-100 rounded-full mb-4">
                  <FileCheck className="h-6 w-6 text-orange-600" />
                </div>
                <h3 className="font-semibold mb-2">Easy Claims</h3>
                <p className="text-gray-600">Streamlined claims process with step-by-step guidance.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gray-50">
        <div className="container mx-auto px-4 py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Take Control of Your Insurance?</h2>
          <p className="text-xl text-gray-600 mb-8">Join thousands of users who have simplified their insurance management.</p>
          <Button size="lg" asChild>
            <Link href="/auth/sign-up">Get Started Now</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
