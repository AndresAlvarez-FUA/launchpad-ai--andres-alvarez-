"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  AlertCircle,
  Bot,
  CalendarClock,
  FileText,
  GitBranch,
  History,
  Home,
  Users,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const navItems = [
  { title: "Home", href: "/", icon: Home },
  { title: "Plan Details", href: "/plan", icon: FileText },
  { title: "Participants", href: "/participants", icon: Users },
  { title: "Payroll Mapping", href: "/payroll-mapping", icon: GitBranch },
  { title: "Payroll Runs", href: "/payroll-runs", icon: CalendarClock },
  { title: "Issues", href: "/issues", icon: AlertCircle },
  { title: "Audit Log", href: "/audit-log", icon: History },
  { title: "AI Assistant", href: "/assistant", icon: Bot },
] as const

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/" className="flex flex-col gap-0.5">
          <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">
            LaunchPad AI
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isActivePath(pathname, item.href)}
                    tooltip={item.title}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
