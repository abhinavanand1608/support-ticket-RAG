FROM python:3.12-slim
WORKDIR /app

# Dependencies layer cached separately from source, same reasoning as the
# .NET Dockerfile: changing main.py shouldn't force a full pip reinstall.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render (and most PaaS hosts) assign the listen port via $PORT at
# container start, not at build time - this has to be read in the shell
# form of CMD so it's resolved when the container actually runs, falling
# back to 8001 for local `docker run` without a PORT env var set.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}"]
