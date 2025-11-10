import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Building2, Users, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Classroom {
  id: string;
  name: string;
  location: string | null;
  building: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

const AdminDashboard = () => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    building: '',
    latitude: '',
    longitude: '',
  });

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const fetchClassrooms = async () => {
    try {
      const { data, error } = await supabase
        .from('classrooms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClassrooms(data || []);
    } catch (error) {
      console.error('Error fetching classrooms:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch classrooms',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const classroomData = {
      name: formData.name,
      location: formData.location || null,
      building: formData.building || null,
      latitude: formData.latitude ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude ? parseFloat(formData.longitude) : null,
    };

    try {
      if (editingClassroom) {
        const { error } = await supabase
          .from('classrooms')
          .update(classroomData)
          .eq('id', editingClassroom.id);

        if (error) throw error;
        toast({ title: 'Success', description: 'Classroom updated successfully' });
      } else {
        const { error } = await supabase
          .from('classrooms')
          .insert([classroomData]);

        if (error) throw error;
        toast({ title: 'Success', description: 'Classroom added successfully' });
      }

      setShowAddDialog(false);
      setEditingClassroom(null);
      setFormData({ name: '', location: '', building: '', latitude: '', longitude: '' });
      fetchClassrooms();
    } catch (error) {
      console.error('Error saving classroom:', error);
      toast({
        title: 'Error',
        description: 'Failed to save classroom',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (classroom: Classroom) => {
    setEditingClassroom(classroom);
    setFormData({
      name: classroom.name,
      location: classroom.location || '',
      building: classroom.building || '',
      latitude: classroom.latitude?.toString() || '',
      longitude: classroom.longitude?.toString() || '',
    });
    setShowAddDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this classroom?')) return;

    try {
      const { error } = await supabase.from('classrooms').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Success', description: 'Classroom deleted successfully' });
      fetchClassrooms();
    } catch (error) {
      console.error('Error deleting classroom:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete classroom',
        variant: 'destructive',
      });
    }
  };

  const stats = {
    totalClassrooms: classrooms.length,
    totalBuildings: new Set(classrooms.filter(c => c.building).map(c => c.building)).size,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage classrooms and system settings</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingClassroom(null);
              setFormData({ name: '', location: '', building: '', latitude: '', longitude: '' });
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Classroom
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingClassroom ? 'Edit Classroom' : 'Add New Classroom'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Classroom Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Room 101"
                  required
                />
              </div>
              <div>
                <Label htmlFor="building">Building</Label>
                <Input
                  id="building"
                  value={formData.building}
                  onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                  placeholder="e.g., Main Building"
                />
              </div>
              <div>
                <Label htmlFor="location">Location/Floor</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., 2nd Floor, East Wing"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    placeholder="e.g., 40.7128"
                  />
                </div>
                <div>
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    placeholder="e.g., -74.0060"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">{editingClassroom ? 'Update' : 'Add'} Classroom</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Classrooms</p>
              <p className="text-2xl font-bold">{stats.totalClassrooms}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Buildings</p>
              <p className="text-2xl font-bold">{stats.totalBuildings}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Classrooms</h2>
        {classrooms.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No classrooms added yet</p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Classroom
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Building</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Coordinates</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classrooms.map((classroom) => (
                <TableRow key={classroom.id}>
                  <TableCell className="font-medium">{classroom.name}</TableCell>
                  <TableCell>{classroom.building || '-'}</TableCell>
                  <TableCell>{classroom.location || '-'}</TableCell>
                  <TableCell>
                    {classroom.latitude && classroom.longitude
                      ? `${classroom.latitude.toFixed(4)}, ${classroom.longitude.toFixed(4)}`
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(classroom)}>
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(classroom.id)}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default AdminDashboard;