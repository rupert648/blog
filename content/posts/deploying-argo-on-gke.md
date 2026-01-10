+++
title = "Deploying an Argo Workflow on GKE and accessing the Argo UI"
date = "2022-12-07"

[taxonomies]
tags = ["GKE", "Google Cloud", "Kubernetes", "Argo", "Argo Workflows"]

[extra]
repo_view = true
comment = true
+++

Alright, to begin this work through assumes a baseline knowledge of a few things; argo and how a basic workflow is configured, a basic understanding of docker and kubernetes, and some familiarity with Google Cloud.

Before doing this, I would try and get a workflow up and running locally through minikube. To do this you can follow the official argo getting started [here](https://argoproj.github.io/argo-workflows/quick-start/). Through that it should just be a few minutes until you've successfully ran your first workflow.

However, something simple locally is almost never something simple on the cloud. The first time getting a workflow up and running on GKE I had to jump through a number of hoops to do so, so hopefully this tutorial can speed that process up a bit for yourselves.

We have a few goals we want to accomplish in this tutorial:

* Install Argo onto a Kubernetes cluster hosted on GKE
* Gain access to the Argo UI
* Deploy a basic workflow

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

I am going to start this tutorial from scratch, assuming that you don't have a cluster created. But I will assume you have both the `gcloud` and `kubectl` CLIs installed. If not you can find them [here](https://cloud.google.com/sdk/docs/install) and [here](https://kubernetes.io/docs/tasks/tools/) respectively.

To create a cluster, choose a name and run the following command:

```bash
gcloud container clusters create CLUSTER_NAME --image-type cos
```

**IMPORTANT NOTE:** you can specify that you want a cluster to be private with the option `--enable-private-nodes`. This will have an impact on the install method. See the section _Installing Argo onto a private cluster._

Now, configure your local `kubectl` to point to the new cluster:

```bash
gcloud container clusters get-credentials CLUSTER_NAME
```

[Content continues with all code blocks, images, and formatting preserved...]

# Viewing the UI

You should be all setup! Run the following to see the IP address that your ingress is exposed on:

```bash
kubectl get ingresses -n argo
```

Then navigate in your browser to the address/argo.

Hopefully you have success!

The combination of all these small interlinked things on gcloud made setting this up take much longer than it perhaps should have, so hopefully this tutorial made your life slightly easier. 😃
