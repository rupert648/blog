---
slug: Deploying an Argo Workflow on GKE and accessing the Argo UI 
title: Deploying an Argo Workflow on GKE and accessing the Argo UI
authors: [rupert]
tags: [GKE, Google Cloud, Kubernetes, Argo, Argo Workflows]
---
# Deploying an Argo Workflow on GKE and accessing the Argo UI

Alright, to begin this work through assumes a baseline knowledge of a few things; argo and how a basic workflow is configured, a basic understanding of docker and kubernetes, and some familiarity with Google Cloud.

Before doing this, I would try and get a workflow up and running locally through minikube. To do this you can follow the official argo getting started [here](https://argoproj.github.io/argo-workflows/quick-start/) . Through that it should just be a few minutes until you’ve successfully ran your first workflow.

However, something simple locally is almost never something simple on the cloud. The first time getting a workflow up and running on GKE I had to jump through a number of hoops to do so, so hopefully this tutorial can speed that process up a bit for yourselves.

We have a few goals we want to accomplish in this tutorial

-   Install Argo onto a Kubernetes cluster hosted on GKE
-   Gain access to the Argo UI
-   Deploy a basic workflow.

# The Workflow

To keep it simple, we will be deploying the following basic workflow, taken from the getting-started page of the argo workflows site.
```yaml
apiVersion: argoproj.io/v1alpha1  
kind: Workflow  
metadata:  
  generateName: hello-world-  
  labels:  
    workflows.argoproj.io/archive-strategy: "false"  
spec:  
  entrypoint: whalesay  
  templates:  
  - name: whalesay  
    container:  
      image: docker/whalesay:latest  
      command: [cowsay]  
      args: ["hello world"]
```

We can put this into a file called `hello-world.yaml` to use later.

# Installing Argo onto GKE

## Creating a Cluster

I am going to start this tutorial from scratch, assuming that you don’t have a cluster created. But I will assume you have both the `gcloud` and `kubectl` CLIs installed. If not you can find them [here](https://cloud.google.com/sdk/docs/install) and [here](https://kubernetes.io/docs/tasks/tools/) respectively.

To create a cluster, choose a name and run the following command:
```bash
gcloud container clusters create CLUSTER_NAME --image-type cos
```
**IMPORTANT NOTE:** you can specify that you want a cluster to be private with the option `--enable-private-nodes` . This will have an impact on the install method. See the section _Installing Argo onto a private cluster._

Now, configure your local `kubectl`to point to the new cluster:
```bash
gcloud container clusters get-credentials CLUSTER_NAME
```
## Installing Argo workflows

I am using **Argo v3.4.1** this tutorial. Hence the following commands may use that version no. The most recent release can be found at [https://github.com/argoproj/argo-workflows/releases](https://github.com/argoproj/argo-workflows/releases)

We will first install the Argo CLI to use locally using these commands:

```bash
# Download the binary  
curl -sLO https://github.com/argoproj/argo-workflows/releases/download/v3.4.1/argo-darwin-amd64.gz  
  
# Unzip  
gunzip argo-darwin-amd64.gz  
  
# Make binary executable  
chmod +x argo-darwin-amd64  
  
# Move binary to path  
mv ./argo-darwin-amd64 /usr/local/bin/argo  
  
# Test installation  
argo version
```
Create a namespace in the cluster in which we will install argo:
```bash
kubectl create ns argo
```
For both of our installation steps, we are going to download the argo workflows installation manifest. This will make it much easier to modify and persist changed configuration.

To download it, use the following link (or change the version number to whatever version you’d like to use)

[https://github.com/argoproj/argo-workflows/releases/download/v3.4.1/install.yaml](https://github.com/argoproj/argo-workflows/releases/download/v3.4.1/install.yaml)

## Installing into a public cluster.

If you are installing into a public cluster, skip to the section _configuring the manifest._ After _Installing into a private cluster_

## Installing into a private cluster.

This is a little more tricky. By default nodes within a private cluster don’t have access to resources outside of google cloud. As a result the above manifest we got from the argo github is unable to pull in the images it needs, which are hosted on quay.io . We can see this on lines 1259 and 1314.
```yaml
spec:  
  containers:  
  - args:  
    - server  
    - --tls-certificate-secret-name=argo-server-tls  
    env: []  
    image: quay.io/argoproj/argocli:v3.4.1  
    name: argo-server
```
Thats okay though! We have two solutions to solve this

-   Create an egress which allows our cluster to access the outer internet
-   Download the images ourselves, and upload them to GCR so they can be accessed by default.

I elected to go with the second, as it requires less config!

First of all, pull the images we need from quay.io
```bash
docker pull quay.io/argoproj/workflow-controller:v3.4.1  
docker pull quay.io/argoproj/argocli:v3.4.1
```
Then push the images to GCR
```bash
gcloud container images add-tag quay.io/argoproj/workflow-controller:v3.4.1 gcr.io/<PROJECT_ID>/workflow-controller:v3.4.2  
gcloud container images add-tag quay.io/argoproj/argocli:v3.4.1 gcr.io/<PROJECT_ID>/argocli:v3.4.2
```
Change <PROJECT_ID> to match the ID of your google cloud project.

Now we just have to go into our install manifest and change the images to point towards our new GCR images.
```yaml
containers:  
  - args:  
      - server  
    image: gcr.io/uk-cti-adtech-k8pip-dev/argocli:v3.4.1  
    name: argo-server
```
```yaml
containers:  
    command:  
      - workflow-controller  
    env:  
      - name: LEADER_ELECTION_IDENTITY  
        valueFrom:  
          fieldRef:  
            apiVersion: v1  
            fieldPath: metadata.name  
    image: gcr.io/uk-cti-adtech-k8pip-dev/workflow-controller:v3.4.1
```
## Configuring the Manifest

We now only have to configure one line in the manifest, this is necessary for later accessing the UI. In your `install.yaml` file, add the following environment variable to the argo-server deployment (should be around line 1260):
```yaml
env:  
  - name: BASE_HREF  
    value: /argo/
```
So your argo-server deployment should look something as follows.
```yaml
spec:  
  containers:  
    - args:  
        - server  
      env:  
        - name: BASE_HREF  
          value: /argo/  
      image: gcr.io/uk-cti-adtech-k8pip-dev/argocli:v3.4.2
```
Now install the manifest onto your Kubernetes cluster using the following.
```bash
kubectl apply -n argo -f install.yaml
```
This will take a few minutes to setup while it spins up all the deployments.

# Running a workflow

Now, fingers crossed, it should be possible to submit your first workflow.

If not done already, create a file called `hello-world.yaml` with the contents of the hello world workflow
```yaml
apiVersion: argoproj.io/v1alpha1  
kind: Workflow  
metadata:  
  generateName: hello-world-  
  labels:  
    workflows.argoproj.io/archive-strategy: "false"  
spec:  
  entrypoint: whalesay  
  templates:  
  - name: whalesay  
    container:  
      image: docker/whalesay:latest  
      command: [cowsay]  
      args: ["hello world"]
```
**NOTE:** if running in a private cluster, you may have the same issue with accessing the docker/whalesay:latest image as before. So you may have to pull this image again and upload it to GCR

Now, to run the workflow, run the following.
```bash
argo submit -n argo --watch hello-world.yaml
```
Run the following to get logs, at which point you should be greeted by a friendly whale saying hello.
```bash
argo logs -n argo @latest
```
# Accessing the UI

This is great and all, but you may be familiar with the fact that argo provides a nice UI, from which you can submit and monitor argo workflows.

Accessing this can be a little complicated, especially on GKE. The following two sections explain two ways of accessing the UI emitted from the argo server.

## Port Forwarding

By far the simplest way to access the UI is to port forward the argo-server by running the following command:
```bash
kubectl -n argo port-forward svc/argo-server 2746:2746
```
Then, navigate to [https://localhost:2746](https://localhost:2746) and you should be able to see the UI. Instructions for how to login are out of the scope for this tutorial, but can be found [here](https://argoproj.github.io/argo-workflows/access-token/#token-creation).

## Creating an Ingress

This second way requires more initial setup, but allows the UI to be outside accessible on a domain/IP, without having to port forward.

Currently, the argo-server service is inaccessible from the outside of the cluster. By creating an ingress, we are creating a reverse proxy which can direct outside traffic to the argo server, then return back the response.

Google Kubernetes already comes with a default ingress installed called `gce` . However this doesn’t support some of the configuration which make creating this ingress much easier, so as a result we will install `nginx.ingress` to provide this service.

To do this you will need the [helm CLI installed.](https://helm.sh/docs/intro/install/)

To install NGINX.Ingress onto the cluster, use the following two commands:
```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx  
helm repo update
```
Then deploy nginx-ingress using helm:
```bash
helm install -n argo nginx-ingress ingress-nginx/ingress-nginx
```
Note that I chose to install this into the argo namespace, although this is not strictly necessary.

We can verify that the nginx controller deployment and service are up and running by running the command:
```bash
kubectl get deployment -n argo nginx-ingress-ingress-nginx-controller  
kubectl get service -n argo nginx-ingress-ingress-nginx-controller
```
Heres the output of the first of those two commands on my cluster

![](https://miro.medium.com/max/1400/1*DZJFlTkxvWkvOl2fnMN-9w.png)

We can see the nginx ingress controller deployment alongside the two argo deployments.

Now we will create a manifest to create an ingress controller. Create a file called `ingress.yaml` with the following contents
```yaml
apiVersion: networking.k8s.io/v1  
kind: Ingress  
metadata:  
  name: argo-server  
  namespace: argo  
  annotations:  
    nginx.ingress.kubernetes.io/rewrite-target: /$2  
    ingress.kubernetes.io/protocol: https # Traefik  
    nginx.ingress.kubernetes.io/backend-protocol: https # ingress-nginx  
spec:  
  ingressClassName: nginx  
  rules:  
    - http:  
        paths:  
          - backend:  
              service:  
                name: argo-server  
                port:  
                  number: 2746  
            path: /argo(/|$)(.*)  
            pathType: Prefix
```
Note that we specify `ingressClassName` to use `nginx` , specifying that we want the ingress to use our nginx controller we just installed.

A few things are important in this file

-   we point to the `argo-server` service so that all traffic is routed to this service
-   These routes are performed based on if the `path` attribute is matched. i.e. any routes ending in /argo/*
-   The path value `/argo(/|$)(.*)` contains a regex capture group. This capture group is used in the annotation `nginx.ingress.kubernetes.io/rewrite-target: /$2` . This means that a path `/argo/*` is mapped to `/*` .
-   For example `/argo/api/v1` becomes `/api/v1`

Now apply this manifest to our cluster using the following:
```bash
kubectl apply -f client-ingress.yaml
```
**NOTE:** I received an error looking similar to the following whilst applying this manifest:
```bash
internal error occurred: failed calling webhook "validate.nginx.ingress.kubernetes.io"
```
The solution to this error can be found in [this github issue](https://github.com/kubernetes/ingress-nginx/issues/5401).

Essentially, run the following command:
```bash
kubectl delete -A ValidatingWebhookConfiguration ingress-nginx-admission
```
Then re-apply the manifest.

## Viewing the UI

You should be all setup! Run the following to see the IP address that your ingress is exposed on.
```bash
kubectl get ingresses -n argo
```
Then navigate in your browser to the address <ip>/argo.

Hopefully you have success!

The combination of all these small interlinked things on gcloud made setting this up take much longer than it perhaps should have, so hopefully this tutorial made your life slightly easier. 😃
