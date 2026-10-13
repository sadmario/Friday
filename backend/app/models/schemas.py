from pydantic import BaseModel, Field
from typing import Optional, Any, List

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = ""
    priority: Optional[str] = "medium"
    due_at: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_at: Optional[str] = None
    completed_at: Optional[str] = None

class ReminderCreate(BaseModel):
    title: str = Field(..., min_length=1)
    scheduled_at: str
    message: Optional[str] = ""
    task_id: Optional[str] = None

class ReminderStatusUpdate(BaseModel):
    status: str
    snoozed_until: Optional[str] = None

class MemoryCreate(BaseModel):
    category: str = "general"
    content: str = Field(..., min_length=1)

class NoteCreate(BaseModel):
    title: str = Field(..., min_length=1)
    content: str = ""

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = None
    stream: Optional[bool] = False
    temperature: Optional[float] = 0.7

class ToolCallRequest(BaseModel):
    tool_name: str
    parameters: dict = Field(default_factory=dict)
    confirmed: Optional[bool] = False

class FileSearchRequest(BaseModel):
    query: str
    extension: Optional[str] = None
    directory: Optional[str] = None

class SpeakRequest(BaseModel):
    text: str
    voice: Optional[str] = None
    rate: Optional[int] = 175
    volume: Optional[float] = 1.0

class SynthesizeRequest(BaseModel):
    text: str
    voice: Optional[str] = "en-US-AvaNeural"
    rate: Optional[str] = "-4%"
    pitch: Optional[str] = "-3Hz"
    volume: Optional[str] = "+0%"

class DailyBriefingResponse(BaseModel):
    greeting: str
    date_str: str
    time_str: str
    pending_tasks_count: int
    upcoming_reminders_count: int
    tasks: List[dict]
    reminders: List[dict]
    system_status: dict
