import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  CheckCircle2, Circle, Loader2, CheckSquare, AlertCircle,
} from "lucide-react";
import { CrmLayout } from "@/components/crm-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Task {
  id: string;
  contactId: string;
  title: string;
  dueDate?: string | null;
  completed: boolean;
  createdAt: string;
}

function isOverdue(dueDate?: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

function groupTasks(tasks: Task[]): { overdue: Task[]; today: Task[]; upcoming: Task[]; completed: Task[] } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const overdue: Task[] = [];
  const today: Task[] = [];
  const upcoming: Task[] = [];
  const completed: Task[] = [];

  for (const t of tasks) {
    if (t.completed) { completed.push(t); continue; }
    if (!t.dueDate) { upcoming.push(t); continue; }
    const d = new Date(t.dueDate);
    if (d < todayStart) overdue.push(t);
    else if (d >= todayStart && d < todayEnd) today.push(t);
    else upcoming.push(t);
  }

  return { overdue, today, upcoming, completed };
}

function TaskRow({ task, onComplete }: { task: Task; onComplete: (id: string) => void }) {
  const overdue = !task.completed && isOverdue(task.dueDate);
  return (
    <div data-testid={`task-row-${task.id}`}
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${overdue ? "border-red-200 bg-red-50/40" : "bg-card"}`}>
      <button
        data-testid={`button-complete-task-${task.id}`}
        onClick={() => onComplete(task.id)}
        className={`mt-0.5 shrink-0 transition-colors ${task.completed ? "text-green-500" : "text-muted-foreground hover:text-green-500"}`}
      >
        {task.completed ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          {task.dueDate && (
            <span className={`text-xs flex items-center gap-1 ${overdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
              {overdue && <AlertCircle className="size-3" />}
              {overdue ? "Overdue: " : "Due: "}
              {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          )}
          <Link href={`/crm/contacts/${task.contactId}`}>
            <a className="text-xs text-[hsl(var(--primary))] hover:underline">View Contact →</a>
          </Link>
        </div>
      </div>
    </div>
  );
}

function TaskGroup({ label, tasks, onComplete, emptyMsg }: {
  label: string;
  tasks: Task[];
  onComplete: (id: string) => void;
  emptyMsg?: string;
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const isCompletedGroup = label === "Completed";

  if (tasks.length === 0 && !emptyMsg) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{label}</h3>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      {tasks.length === 0 && emptyMsg ? (
        <p className="text-sm text-muted-foreground py-2">{emptyMsg}</p>
      ) : isCompletedGroup ? (
        <>
          <Button size="sm" variant="ghost" className="text-xs mb-2" onClick={() => setShowCompleted(!showCompleted)}>
            {showCompleted ? "Hide" : "Show"} completed ({tasks.length})
          </Button>
          {showCompleted && (
            <div className="space-y-2">
              {tasks.slice(0, 20).map((t) => <TaskRow key={t.id} task={t} onComplete={onComplete} />)}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => <TaskRow key={t.id} task={t} onComplete={onComplete} />)}
        </div>
      )}
    </div>
  );
}

export default function CrmTasksPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState<"open" | "all">("open");

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/tasks");
      return res.json();
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("PATCH", `/api/tasks/${taskId}`, { completed: true });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task completed" });
    },
    onError: () => toast({ title: "Failed to complete task", variant: "destructive" }),
  });

  const { overdue, today, upcoming, completed } = groupTasks(tasks);
  const openCount = overdue.length + today.length + upcoming.length;

  return (
    <CrmLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tasks</h1>
            <p className="text-sm text-muted-foreground">
              {openCount} open · {overdue.length} overdue · {completed.length} completed
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={showAll === "open" ? "default" : "outline"} onClick={() => setShowAll("open")}>Open</Button>
            <Button size="sm" variant={showAll === "all" ? "default" : "outline"} onClick={() => setShowAll("all")}>All</Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : tasks.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <CheckSquare className="size-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">No tasks yet</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Add tasks from a contact's profile page.
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {overdue.length > 0 && (
              <Card className="p-5 border-red-200">
                <TaskGroup label="🔴 Overdue" tasks={overdue} onComplete={(id) => completeMutation.mutate(id)} />
              </Card>
            )}
            <Card className="p-5">
              <TaskGroup label="Today" tasks={today} onComplete={(id) => completeMutation.mutate(id)} emptyMsg="No tasks due today" />
            </Card>
            <Card className="p-5">
              <TaskGroup label="Upcoming" tasks={upcoming} onComplete={(id) => completeMutation.mutate(id)} emptyMsg="No upcoming tasks" />
            </Card>
            {showAll === "all" && (
              <Card className="p-5">
                <TaskGroup label="Completed" tasks={completed} onComplete={(id) => completeMutation.mutate(id)} />
              </Card>
            )}
          </div>
        )}
      </div>
    </CrmLayout>
  );
}
