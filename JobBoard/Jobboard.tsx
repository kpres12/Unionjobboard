'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Search, Briefcase, Users } from "lucide-react"
import Link from "next/link"

// Placeholder data for job listings
const jobListings = [
  {
    id: 1,
    title: "Cooperative Marketing Manager",
    company: "Green Valley Co-op",
    location: "Portland, OR",
    type: "Co-op",
    postedDate: "2023-07-01",
  },
  {
    id: 2,
    title: "Union Electrician",
    company: "Local 48 IBEW",
    location: "Chicago, IL",
    type: "Union",
    postedDate: "2023-06-28",
  },
  {
    id: 3,
    title: "Worker-Owned Bakery Associate",
    company: "People's Bread Collective",
    location: "Austin, TX",
    type: "Co-op",
    postedDate: "2023-06-30",
  },
]

export default function JobBoard() {
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    // Here you would typically send a request to your authentication API
    console.log("Login attempted with:", email, password)
    setIsLoginOpen(false)
    // Reset form fields
    setEmail("")
    setPassword("")
  }

  return (
    <div className="flex flex-col min-h-screen bg-amber-50">
      <style jsx global>{`
        :root {
          --primary: 0 72% 51%;
          --primary-foreground: 60 100% 97%;
          --secondary: 45 93% 47%;
          --secondary-foreground: 0 0% 0%;
          --muted: 0 62% 90%;
          --muted-foreground: 0 0% 20%;
          --accent: 45 93% 47%;
          --accent-foreground: 0 0% 0%;
        }
      `}</style>
      <header className="bg-primary text-primary-foreground py-6">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/" className="text-3xl font-bold">Co-op & Union Jobs</Link>
          <nav className="flex items-center space-x-6">
            <ul className="flex space-x-6">
              <li><Link href="/about" className="hover:underline text-lg">About</Link></li>
              <li><Link href="/post-job" className="hover:underline text-lg">Post a Job</Link></li>
              <li><Link href="/resources" className="hover:underline text-lg">Resources</Link></li>
            </ul>
            <Dialog open={isLoginOpen} onOpenChange={setIsLoginOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-secondary text-secondary-foreground hover:bg-secondary/90">Login</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Login to Your Account</DialogTitle>
                  <DialogDescription>Enter your email and password to access your account.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      required 
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      required 
                    />
                  </div>
                  <Button type="submit" className="w-full">Login</Button>
                </form>
              </DialogContent>
            </Dialog>
          </nav>
        </div>
      </header>

      <main className="flex-grow container mx-auto py-12">
        <section className="mb-16">
          <h1 className="text-5xl font-bold mb-8 text-primary">Find Co-op and Union Jobs</h1>
          <div className="flex space-x-4">
            <Input placeholder="Job title or keywords" className="flex-grow text-lg py-6" />
            <Input placeholder="Location" className="flex-grow text-lg py-6" />
            <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-lg px-8 py-6">
              <Search className="mr-2 h-5 w-5" /> Search
            </Button>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-semibold mb-8 text-primary">Featured Job Listings</h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {jobListings.map((job) => (
              <Card key={job.id} className="border-2 border-primary/20 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="text-xl text-primary">{job.title}</CardTitle>
                  <CardDescription className="text-muted-foreground">{job.company}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="flex items-center text-muted-foreground"><Briefcase className="mr-2 h-5 w-5" /> {job.location}</p>
                  <p className="flex items-center text-muted-foreground"><Users className="mr-2 h-5 w-5" /> {job.type}</p>
                </CardContent>
                <CardFooter className="flex justify-between items-center">
                  <Badge className="bg-accent text-accent-foreground">{job.type}</Badge>
                  <Button variant="outline" className="border-2 border-primary hover:bg-primary hover:text-primary-foreground transition-colors">
                    Apply Now
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-muted py-8">
        <div className="container mx-auto text-center">
          <p className="text-muted-foreground">&copy; 2023 Co-op & Union Job Board. All rights reserved.</p>
          <div className="mt-6">
            <Link href="/terms" className="text-muted-foreground hover:text-primary mr-6">Terms of Service</Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-primary mr-6">Privacy Policy</Link>
            <Link href="/contact" className="text-muted-foreground hover:text-primary">Contact Us</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}