import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export type UserRole = 'Admin' | 'Manager' | 'Staff' | 'Driver' | 0 | 1 | 2 | 3;

interface ProtectedRouteProps {
  element: React.ReactNode;
  requiredRoles?: UserRole[];
}

export function ProtectedRoute({ element, requiredRoles }: ProtectedRouteProps) {
  const { user } = useAuth();

  // Chưa đăng nhập
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Kiểm tra role nếu có yêu cầu
  if (requiredRoles && requiredRoles.length > 0) {
    const roleNames = ['Admin', 'Manager', 'Staff', 'Driver'] as const;
    const userRoleValue = user.role;
    const userRoleString = typeof userRoleValue === 'number' ? roleNames[userRoleValue as number] : (userRoleValue as string);

    const hasRequiredRole =
      requiredRoles.includes(userRoleValue as any) ||
      requiredRoles.includes(userRoleString as any);

    if (!hasRequiredRole) {
      return <Navigate to="/" replace />;
    }
  }

  return element;
}
