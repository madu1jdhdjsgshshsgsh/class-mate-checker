import { ReactNode } from 'react';
import { Bell, Settings, LogOut, GraduationCap, Calendar, Users, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useNavigate, useLocation } from 'react-router-dom';

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { profile, hasRole, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-primary rounded-lg">
                <GraduationCap className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">AttendanceHub</h1>
                <p className="text-xs text-muted-foreground capitalize">
                  {hasRole('admin') ? 'Admin' : profile?.role} Dashboard
                </p>
              </div>
            </div>
            
            {/* Navigation Links */}
            <nav className="hidden md:flex items-center space-x-2 ml-8">
              <Button
                variant={location.pathname === '/' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => navigate('/')}
              >
                <Home className="w-4 h-4 mr-2" />
                Home
              </Button>
              
              {(profile?.role === 'teacher' || hasRole('admin')) && (
                <>
                  <Button
                    variant={location.pathname === '/sessions' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => navigate('/sessions')}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Sessions
                  </Button>
                  <Button
                    variant={location.pathname === '/student-management' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => navigate('/student-management')}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Students
                  </Button>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <div className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative" 
                onClick={() => navigate('/notifications')}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs p-0"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </div>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex flex-col space-y-1 p-2">
                  <p className="text-sm font-medium leading-none">{profile?.full_name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {profile?.email}
                  </p>
                  <Badge variant="secondary" className="w-fit mt-1 capitalize">
                    {profile?.role}
                  </Badge>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;