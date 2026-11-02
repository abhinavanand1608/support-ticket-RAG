from pydantic import BaseModel
from typing import Literal

class ClassifyRequest(BaseModel):
    title: str
    description: str

class ClassifyResponse(BaseModel):
    category: Literal["Billing", "Technical", "Bug", "Feature"]
    priority: Literal["Low", "Medium", "High", "Critical"]