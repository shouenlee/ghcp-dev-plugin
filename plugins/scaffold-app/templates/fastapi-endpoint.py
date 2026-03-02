"""
FastAPI endpoint template.
Adapt to project conventions before use.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

router = APIRouter(prefix="/{resource_plural}", tags=["{resource}"])


class {Resource}Create(BaseModel):
    """Request schema for creating a {resource}."""
    name: str


class {Resource}Response(BaseModel):
    """Response schema for {resource}."""
    id: int
    name: str

    model_config = {"from_attributes": True}


@router.post("/", response_model={Resource}Response, status_code=status.HTTP_201_CREATED)
async def create_{resource}(payload: {Resource}Create):
    """Create a new {resource}."""
    # TODO: implement
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED)


@router.get("/{{{resource}_id}}", response_model={Resource}Response)
async def get_{resource}({resource}_id: int):
    """Get a {resource} by ID."""
    # TODO: implement
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED)


@router.get("/", response_model=list[{Resource}Response])
async def list_{resource_plural}():
    """List all {resource_plural}."""
    # TODO: implement
    return []
